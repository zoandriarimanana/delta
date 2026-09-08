"""Tests du service PAIEMENT, contre PostgreSQL uniquement (cf.
test_paiement_model.py)."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, ReferenceInvalide
from app.core.security import hacher_mot_de_passe
from app.models.client import Client, TypeClient
from app.models.client_particulier import ClientParticulier
from app.models.commande import Commande, StatutCommande, TypeCommande
from app.models.paiement import FournisseurPaiement, MethodePaiement, StatutPaiement
from app.schemas.paiement import PaiementCreate
from app.services.paiement_service import PaiementService
from app.services.passerelle_paiement_simulee import (
    ComportementSimulation,
    PasserelleSimulee,
)

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


def _client(db: Session) -> Client:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email="a@delta.mg",
        mot_de_passe=MOT_DE_PASSE,
    )
    client.particulier = ClientParticulier(
        nom="Rakoto", prenom="Jean", date_naissance=date(1990, 1, 1)
    )
    db.add(client)
    db.flush()
    return client


def _commande(
    db: Session, client: Client, statut: StatutCommande = StatutCommande.EN_ATTENTE
) -> Commande:
    commande = Commande(
        type_commande=TypeCommande.SUR_PLACE,
        statut=statut,
        montant_total=Decimal("5000.00"),
        id_client=client.id_client,
    )
    db.add(commande)
    db.flush()
    return commande


def _donnees() -> PaiementCreate:
    return PaiementCreate(
        methode=MethodePaiement.MOBILE_MONEY, fournisseur=FournisseurPaiement.MVOLA
    )


def _service(
    db: Session, comportement: ComportementSimulation | None = None
) -> PaiementService:
    passerelle = PasserelleSimulee(comportement) if comportement is not None else None
    return PaiementService(db, passerelle)


# --- Initiation ------------------------------------------------------------


def test_initier_recopie_le_montant_de_la_commande(db: Session) -> None:
    client = _client(db)
    commande = _commande(db, client)
    service = _service(db)

    paiement = service.initier(commande, _donnees())

    assert paiement.montant == commande.montant_total


def test_initier_retourne_toujours_en_attente(db: Session) -> None:
    """Même avec une passerelle configurée `toujours_reussi`, le paiement
    initié reste `En_attente` : c'est la garantie du contrat
    `PasserellePaiement`, pas un choix du service (cf. `docs/mld.md`)."""
    client = _client(db)
    commande = _commande(db, client)
    service = _service(db, ComportementSimulation.TOUJOURS_REUSSI)

    paiement = service.initier(commande, _donnees())

    assert paiement.statut == StatutPaiement.EN_ATTENTE


def test_initier_refuse_une_commande_annulee(db: Session) -> None:
    client = _client(db)
    commande = _commande(db, client, statut=StatutCommande.ANNULEE)
    service = _service(db)

    with pytest.raises(ConflitMetier):
        service.initier(commande, _donnees())


# --- Double paiement ---------------------------------------------------


def test_initier_refuse_si_un_paiement_reussi_existe_deja(db: Session) -> None:
    """Pré-contrôle applicatif : produit un 409 lisible avant même
    d'écrire, sans passer par la traduction d'`IntegrityError`."""
    client = _client(db)
    commande = _commande(db, client)
    service = _service(db)
    premier = service.initier(commande, _donnees())
    premier.statut = StatutPaiement.REUSSI
    db.flush()

    with pytest.raises(ConflitMetier):
        service.initier(commande, _donnees())


def test_initier_n_ecrit_jamais_reussi_directement(db: Session) -> None:
    """Corollaire du contrat `PasserellePaiement` : `initier()` ne peut donc
    jamais, à elle seule, violer `uq_paiement_commande_reussi` — même avec
    une passerelle configurée `toujours_reussi`. La course que cet index
    protège se situe entre deux *confirmations* concurrentes (webhook,
    Sprint 9.4), pas deux initiations (cf. `docs/mld.md`)."""
    client = _client(db)
    commande = _commande(db, client)
    service = _service(db, ComportementSimulation.TOUJOURS_REUSSI)

    premier = service.initier(commande, _donnees())
    second = service.initier(commande, _donnees())

    assert premier.statut == StatutPaiement.EN_ATTENTE
    assert second.statut == StatutPaiement.EN_ATTENTE


def test_plusieurs_tentatives_echouees_sont_acceptees(db: Session) -> None:
    client = _client(db)
    commande = _commande(db, client)
    service = _service(db)
    premier = service.initier(commande, _donnees())
    premier.statut = StatutPaiement.ECHOUE
    db.flush()

    second = service.initier(commande, _donnees())

    assert second.id_paiement != premier.id_paiement


# --- Confirmation (9.4) ------------------------------------------------


def test_confirmer_reussi_fait_progresser_la_commande(db: Session) -> None:
    client = _client(db)
    commande = _commande(db, client)
    service = _service(db)
    paiement = service.initier(commande, _donnees())

    resultat = service.confirmer(paiement.reference_externe, StatutPaiement.REUSSI)

    assert resultat.statut == StatutPaiement.REUSSI
    assert commande.statut == StatutCommande.CONFIRMEE


def test_confirmer_echoue_n_a_aucun_effet_sur_la_commande(db: Session) -> None:
    client = _client(db)
    commande = _commande(db, client)
    service = _service(db)
    paiement = service.initier(commande, _donnees())

    service.confirmer(paiement.reference_externe, StatutPaiement.ECHOUE)

    assert commande.statut == StatutCommande.EN_ATTENTE


def test_confirmer_reference_inconnue_leve_reference_invalide(db: Session) -> None:
    service = _service(db)

    with pytest.raises(ReferenceInvalide):
        service.confirmer("ref-inexistante", StatutPaiement.REUSSI)


def test_confirmer_ne_regresse_jamais_un_statut_de_commande_plus_avance(
    db: Session,
) -> None:
    """Une confirmation tardive, sur une commande déjà bien avancée, ne doit
    pas la ramener en arrière."""
    client = _client(db)
    commande = _commande(db, client)
    service = _service(db)
    paiement = service.initier(commande, _donnees())
    commande.statut = StatutCommande.SERVIE
    db.flush()

    service.confirmer(paiement.reference_externe, StatutPaiement.REUSSI)

    assert commande.statut == StatutCommande.SERVIE


def test_confirmer_est_idempotent(db: Session) -> None:
    """Un webhook peut être livré plusieurs fois par le fournisseur : la
    seconde confirmation ne doit rien rejouer, quel que soit son contenu."""
    client = _client(db)
    commande = _commande(db, client)
    service = _service(db)
    paiement = service.initier(commande, _donnees())
    service.confirmer(paiement.reference_externe, StatutPaiement.REUSSI)
    assert commande.statut == StatutCommande.CONFIRMEE

    # Deuxième webhook, contradictoire : ne doit ni changer le paiement ni
    # toucher la commande à nouveau.
    resultat = service.confirmer(paiement.reference_externe, StatutPaiement.ECHOUE)

    assert resultat.statut == StatutPaiement.REUSSI
    assert commande.statut == StatutCommande.CONFIRMEE


def test_confirmer_rejoue_sans_toucher_une_commande_avancee_depuis(db: Session) -> None:
    """Cas distinct de `test_confirmer_ne_regresse_jamais_...` (qui porte sur
    la *première* confirmation d'un paiement encore `En_attente`) et de
    `test_confirmer_est_idempotent` (dont la commande reste à `Confirmee`
    au moment du rejeu). Ici, le rejeu arrive après que la commande a
    avancé, par un autre chemin (la livraison, Sprint 3), bien au-delà de
    `Confirmee` — le webhook rejoué ne doit toucher ni le paiement ni la
    commande, l'un comme l'autre étant déjà réglés."""
    client = _client(db)
    commande = _commande(db, client)
    service = _service(db)
    paiement = service.initier(commande, _donnees())
    service.confirmer(paiement.reference_externe, StatutPaiement.REUSSI)
    assert commande.statut == StatutCommande.CONFIRMEE

    # La commande avance indépendamment du paiement — remise effectuée,
    # synchronisation LIVRAISON -> COMMANDE (Sprint 3).
    commande.statut = StatutCommande.SERVIE
    db.flush()

    resultat = service.confirmer(paiement.reference_externe, StatutPaiement.REUSSI)

    assert resultat.statut == StatutPaiement.REUSSI
    assert commande.statut == StatutCommande.SERVIE


def test_confirmer_traduit_la_course_entre_deux_confirmations_en_conflit(
    db: Session,
) -> None:
    """Preuve que la traduction d'`IntegrityError` vit bien dans
    `confirmer()` — et non dans `initier()`, où elle serait du code mort
    (cf. `docs/mld.md`). Deux paiements distincts pour la même commande,
    tous deux confirmés `Reussi` : le second doit être refusé."""
    client = _client(db)
    commande = _commande(db, client)
    service = _service(db)
    premier = service.initier(commande, _donnees())
    second = service.initier(commande, _donnees())

    service.confirmer(premier.reference_externe, StatutPaiement.REUSSI)

    with pytest.raises(ConflitMetier):
        service.confirmer(second.reference_externe, StatutPaiement.REUSSI)
