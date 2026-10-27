"""Tests du modèle PAIEMENT, contre PostgreSQL uniquement.

Aucune couche applicative n'existe encore pour PAIEMENT (9.1 ne pose que le
schéma) : ces tests vérifient directement, par `INSERT` SQLAlchemy, que les
contraintes posées en base sont réellement appliquées par PostgreSQL — pas
seulement déclarées dans le modèle Python.
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hacher_mot_de_passe
from app.models.client import Client, TypeClient
from app.models.client_particulier import ClientParticulier
from app.models.commande import Commande, StatutCommande, TypeCommande
from app.models.paiement import (
    FournisseurPaiement,
    MethodePaiement,
    Paiement,
    StatutPaiement,
)

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


def _client(db: Session) -> Client:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"{uuid4().hex[:8]}@delta.mg",
        mot_de_passe=MOT_DE_PASSE,
    )
    client.particulier = ClientParticulier(
        nom="Rakoto", prenom="Jean", date_naissance=date(1990, 1, 1)
    )
    db.add(client)
    db.flush()
    return client


def _commande(db: Session, client: Client) -> Commande:
    commande = Commande(
        type_commande=TypeCommande.SUR_PLACE,
        statut=StatutCommande.EN_ATTENTE,
        montant_total=Decimal("5000.00"),
        id_client=client.id_client,
    )
    db.add(commande)
    db.flush()
    return commande


def _paiement(
    db: Session,
    commande: Commande,
    *,
    statut: StatutPaiement,
    reference: str | None = None,
) -> Paiement:
    paiement = Paiement(
        montant=Decimal("5000.00"),
        methode=MethodePaiement.MOBILE_MONEY,
        fournisseur=FournisseurPaiement.MVOLA,
        statut=statut,
        reference_externe=reference or f"ref-{uuid4().hex[:12]}",
        id_commande=commande.id_commande,
    )
    db.add(paiement)
    db.flush()
    return paiement


# --- Domaines formels --------------------------------------------------------


def test_methode_hors_domaine_est_rejetee(db: Session) -> None:
    client = _client(db)
    commande = _commande(db, client)
    paiement = Paiement(
        montant=Decimal("5000.00"),
        methode="Cheque",
        fournisseur=FournisseurPaiement.MVOLA,
        statut=StatutPaiement.EN_ATTENTE,
        reference_externe="ref-invalide-methode",
        id_commande=commande.id_commande,
    )
    db.add(paiement)
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_fournisseur_hors_domaine_est_rejete(db: Session) -> None:
    client = _client(db)
    commande = _commande(db, client)
    paiement = Paiement(
        montant=Decimal("5000.00"),
        methode=MethodePaiement.CARTE,
        fournisseur="PayPal",
        statut=StatutPaiement.EN_ATTENTE,
        reference_externe="ref-invalide-fournisseur",
        id_commande=commande.id_commande,
    )
    db.add(paiement)
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


# --- Unicité de reference_externe -------------------------------------------


def test_reference_externe_dupliquee_est_rejetee(db: Session) -> None:
    client = _client(db)
    commande = _commande(db, client)
    _paiement(db, commande, statut=StatutPaiement.EN_ATTENTE, reference="ref-fixe")

    with pytest.raises(IntegrityError):
        _paiement(db, commande, statut=StatutPaiement.EN_ATTENTE, reference="ref-fixe")
    db.rollback()


# --- Au plus un paiement Reussi actif par commande --------------------------


def test_un_second_paiement_reussi_sur_la_meme_commande_est_rejete(
    db: Session,
) -> None:
    """La garantie est structurelle, pas seulement applicative : ce test
    insère directement en base, sans passer par un service (aucun n'existe
    encore pour PAIEMENT), pour prouver que PostgreSQL refuse à lui seul."""
    client = _client(db)
    commande = _commande(db, client)
    _paiement(db, commande, statut=StatutPaiement.REUSSI)

    with pytest.raises(IntegrityError) as excinfo:
        _paiement(db, commande, statut=StatutPaiement.REUSSI)
    assert "uq_paiement_commande_reussi" in str(excinfo.value)
    db.rollback()


def test_plusieurs_tentatives_echouees_sont_acceptees(db: Session) -> None:
    """Aucune contrainte ne limite les tentatives échouées : seul un
    paiement Reussi est exclusif."""
    client = _client(db)
    commande = _commande(db, client)

    _paiement(db, commande, statut=StatutPaiement.ECHOUE)
    _paiement(db, commande, statut=StatutPaiement.ECHOUE)
    troisieme = _paiement(db, commande, statut=StatutPaiement.REUSSI)

    assert troisieme.statut == StatutPaiement.REUSSI


def test_un_paiement_reussi_archive_ne_bloque_plus_une_nouvelle_tentative(
    db: Session,
) -> None:
    """L'index est partiel (`WHERE ... AND supprime_le IS NULL`) : un
    paiement Reussi archivé sort de sa portée, une nouvelle tentative
    Reussi doit donc réussir."""
    client = _client(db)
    commande = _commande(db, client)
    premier = _paiement(db, commande, statut=StatutPaiement.REUSSI)

    premier.supprime_le = datetime.now(UTC)
    db.flush()

    second = _paiement(db, commande, statut=StatutPaiement.REUSSI)

    assert second.id_paiement != premier.id_paiement
