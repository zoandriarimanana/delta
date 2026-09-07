"""Tests du service AVIS, contre PostgreSQL uniquement (cf. test_avis_repository.py)."""

from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, ReferenceInvalide, RessourceIntrouvable
from app.core.security import hacher_mot_de_passe
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.client_particulier import ClientParticulier
from app.models.commande import Commande, StatutCommande, TypeCommande
from app.models.ligne_commande import LigneCommande
from app.models.produit import Produit
from app.models.reservation import Reservation, StatutReservation, TypeReservation
from app.schemas.avis import AvisCreate
from app.services.avis_service import AvisService

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def service(db: Session) -> AvisService:
    return AvisService(db)


def _client(db: Session, email: str = "a@delta.mg") -> Client:
    client = Client(
        type_client=TypeClient.PARTICULIER, email=email, mot_de_passe=MOT_DE_PASSE
    )
    client.particulier = ClientParticulier(
        nom="Rakoto", prenom="Jean", date_naissance=date(1990, 1, 1)
    )
    db.add(client)
    db.flush()
    return client


def _ligne(db: Session, client: Client) -> LigneCommande:
    categorie = CategorieProduit(libelle=f"Cat-{client.id_client}")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Baguette",
        description="desc",
        prix_unitaire=1000,
        unite_mesure="unite",
        stock_disponible=10,
        est_personnalisable=False,
        est_livrable=True,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.flush()
    commande = Commande(
        type_commande=TypeCommande.SUR_PLACE,
        statut=StatutCommande.SERVIE,
        montant_total=1000,
        id_client=client.id_client,
    )
    db.add(commande)
    db.flush()
    ligne = LigneCommande(
        quantite=1,
        prix_unitaire_applique=1000,
        id_commande=commande.id_commande,
        id_produit=produit.id_produit,
    )
    db.add(ligne)
    db.flush()
    return ligne


def _reservation(db: Session, client: Client) -> Reservation:
    reservation = Reservation(
        type_reservation=TypeReservation.TABLE,
        date_debut=date(2026, 1, 1),
        date_fin=date(2026, 1, 1),
        nombre_personnes=2,
        statut=StatutReservation.HONOREE,
        avec_hebergement=False,
        id_client=client.id_client,
    )
    db.add(reservation)
    db.flush()
    return reservation


# --- Créer : cible Produit ---------------------------------------------------


def test_creer_avis_produit_pour_sa_propre_ligne(
    db: Session, service: AvisService
) -> None:
    client = _client(db)
    ligne = _ligne(db, client)

    avis = service.creer(
        AvisCreate(type_avis="Produit", note=5, id_ligne=ligne.id_ligne), client
    )

    assert avis.id_client == client.id_client
    assert avis.id_ligne == ligne.id_ligne


def test_creer_avis_produit_refuse_la_ligne_d_un_autre_client(
    db: Session, service: AvisService
) -> None:
    proprietaire = _client(db, "a@delta.mg")
    autre = _client(db, "b@delta.mg")
    ligne = _ligne(db, proprietaire)

    with pytest.raises(ReferenceInvalide):
        service.creer(
            AvisCreate(type_avis="Produit", note=5, id_ligne=ligne.id_ligne), autre
        )


def test_creer_avis_produit_ligne_inexistante(
    db: Session, service: AvisService
) -> None:
    client = _client(db)

    with pytest.raises(ReferenceInvalide):
        service.creer(AvisCreate(type_avis="Produit", note=5, id_ligne=999), client)


# --- Créer : cible Service (réservation) ------------------------------------


def test_creer_avis_service_pour_sa_propre_reservation(
    db: Session, service: AvisService
) -> None:
    client = _client(db)
    reservation = _reservation(db, client)

    avis = service.creer(
        AvisCreate(
            type_avis="Service", note=4, id_reservation=reservation.id_reservation
        ),
        client,
    )

    assert avis.id_reservation == reservation.id_reservation


def test_creer_avis_service_refuse_la_reservation_d_un_autre_client(
    db: Session, service: AvisService
) -> None:
    proprietaire = _client(db, "a@delta.mg")
    autre = _client(db, "b@delta.mg")
    reservation = _reservation(db, proprietaire)

    with pytest.raises(ReferenceInvalide):
        service.creer(
            AvisCreate(
                type_avis="Service", note=4, id_reservation=reservation.id_reservation
            ),
            autre,
        )


# --- Unicité par cible --------------------------------------------------


def test_creer_deux_avis_sur_la_meme_ligne_donne_conflit(
    db: Session, service: AvisService
) -> None:
    client = _client(db)
    ligne = _ligne(db, client)
    service.creer(
        AvisCreate(type_avis="Produit", note=5, id_ligne=ligne.id_ligne), client
    )

    with pytest.raises(ConflitMetier):
        service.creer(
            AvisCreate(type_avis="Produit", note=3, id_ligne=ligne.id_ligne), client
        )


def test_avis_archive_peut_etre_remplace(db: Session, service: AvisService) -> None:
    """Cas de modération, cf. `docs/mld.md` : un avis retiré doit pouvoir
    être remplacé par un nouveau — vérifié ici au niveau service, pas
    seulement en SQL brut."""
    client = _client(db)
    ligne = _ligne(db, client)
    premier = service.creer(
        AvisCreate(type_avis="Produit", note=5, id_ligne=ligne.id_ligne), client
    )
    service.avis.delete(premier)
    db.commit()

    second = service.creer(
        AvisCreate(type_avis="Produit", note=2, id_ligne=ligne.id_ligne), client
    )

    assert second.id_avis != premier.id_avis


# --- Lecture ---------------------------------------------------------------


def test_obtenir_avis_inexistant_leve_ressource_introuvable(
    service: AvisService,
) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(999)


def test_lister_retourne_tous_les_avis_actifs(
    db: Session, service: AvisService
) -> None:
    client = _client(db)
    ligne = _ligne(db, client)
    service.creer(
        AvisCreate(type_avis="Produit", note=5, id_ligne=ligne.id_ligne), client
    )

    resultat = service.lister()

    assert len(resultat) == 1
