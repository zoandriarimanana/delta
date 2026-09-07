"""Tests du repository AVIS, contre PostgreSQL uniquement.

`AVIS` porte un `CHECK` croisant deux colonnes et deux index uniques
partiels : mêmes raisons que `test_beneficiaire_repository.py` d'écarter
SQLite.
"""

from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.core.security import hacher_mot_de_passe
from app.models.avis import Avis, TypeAvis
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.client_particulier import ClientParticulier
from app.models.commande import Commande, StatutCommande, TypeCommande
from app.models.ligne_commande import LigneCommande
from app.models.produit import Produit
from app.models.reservation import Reservation, StatutReservation, TypeReservation
from app.repositories.avis_repository import AvisRepository

MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def repository(db: Session) -> AvisRepository:
    return AvisRepository(db)


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


def test_par_ligne_ne_retourne_que_les_avis_actifs(
    db: Session, repository: AvisRepository
) -> None:
    client = _client(db)
    ligne = _ligne(db, client)
    avis = Avis(
        type_avis=TypeAvis.PRODUIT,
        note=5,
        id_client=client.id_client,
        id_ligne=ligne.id_ligne,
    )
    db.add(avis)
    db.flush()

    resultat = repository.par_ligne(ligne.id_ligne)

    assert len(resultat) == 1
    assert resultat[0].id_avis == avis.id_avis


def test_par_ligne_exclut_les_avis_archives(
    db: Session, repository: AvisRepository
) -> None:
    from datetime import UTC, datetime

    client = _client(db)
    ligne = _ligne(db, client)
    avis = Avis(
        type_avis=TypeAvis.PRODUIT,
        note=5,
        id_client=client.id_client,
        id_ligne=ligne.id_ligne,
    )
    avis.supprime_le = datetime.now(UTC)
    db.add(avis)
    db.flush()

    resultat = repository.par_ligne(ligne.id_ligne)

    assert resultat == []


def test_par_reservation_ne_retourne_que_les_avis_actifs(
    db: Session, repository: AvisRepository
) -> None:
    client = _client(db)
    reservation = _reservation(db, client)
    avis = Avis(
        type_avis=TypeAvis.SERVICE,
        note=4,
        id_client=client.id_client,
        id_reservation=reservation.id_reservation,
    )
    db.add(avis)
    db.flush()

    resultat = repository.par_reservation(reservation.id_reservation)

    assert len(resultat) == 1
    assert resultat[0].id_avis == avis.id_avis
