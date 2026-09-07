"""Tests HTTP de AVIS, contre PostgreSQL uniquement (cf. test_avis_repository.py)."""

from collections.abc import Iterator
from datetime import date
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, creer_jeton_acces, hacher_mot_de_passe
from app.main import app
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.client_particulier import ClientParticulier
from app.models.commande import Commande, StatutCommande, TypeCommande
from app.models.ligne_commande import LigneCommande
from app.models.produit import Produit
from app.models.reservation import Reservation, StatutReservation, TypeReservation

AVIS = f"{settings.API_V1_PREFIX}/avis"
MDP = "motdepasse123"


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def client_http(db: Session) -> Iterator[TestClient]:
    def _get_db() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as testeur:
            yield testeur
    finally:
        app.dependency_overrides.clear()


def _client(db: Session, email: str = "a@delta.mg") -> Client:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email=email,
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    client.particulier = ClientParticulier(
        nom="Rakoto", prenom="Jean", date_naissance=date(1990, 1, 1)
    )
    db.add(client)
    db.commit()
    return client


def _ligne(db: Session, client: Client) -> LigneCommande:
    categorie = CategorieProduit(libelle=f"Cat-{client.id_client}-{uuid4().hex[:8]}")
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
    db.commit()
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
    db.commit()
    return reservation


def _entete(compte: Client) -> dict[str, str]:
    jeton = creer_jeton_acces(compte.id_client, TypeSujet.CLIENT)
    return {"Authorization": f"Bearer {jeton}"}


@pytest.fixture
def client(db: Session) -> Client:
    return _client(db)


@pytest.fixture
def entete_client(client: Client) -> dict[str, str]:
    return _entete(client)


def test_creation_sans_jeton_est_refusee(client_http: TestClient) -> None:
    reponse = client_http.post(
        AVIS, json={"type_avis": "Produit", "note": 5, "id_ligne": 1}
    )

    assert reponse.status_code == 401


def test_creation_sur_sa_propre_ligne(
    client_http: TestClient,
    entete_client: dict[str, str],
    db: Session,
    client: Client,
) -> None:
    ligne = _ligne(db, client)

    reponse = client_http.post(
        AVIS,
        json={"type_avis": "Produit", "note": 5, "id_ligne": ligne.id_ligne},
        headers=entete_client,
    )

    assert reponse.status_code == 201
    assert reponse.json()["note"] == 5


def test_creation_sur_la_ligne_d_un_autre_client_retourne_422(
    client_http: TestClient, entete_client: dict[str, str], db: Session
) -> None:
    autre = _client(db, "b@delta.mg")
    ligne = _ligne(db, autre)

    reponse = client_http.post(
        AVIS,
        json={"type_avis": "Produit", "note": 5, "id_ligne": ligne.id_ligne},
        headers=entete_client,
    )

    assert reponse.status_code == 422


def test_creation_en_double_retourne_409(
    client_http: TestClient,
    entete_client: dict[str, str],
    db: Session,
    client: Client,
) -> None:
    ligne = _ligne(db, client)
    client_http.post(
        AVIS,
        json={"type_avis": "Produit", "note": 5, "id_ligne": ligne.id_ligne},
        headers=entete_client,
    )

    reponse = client_http.post(
        AVIS,
        json={"type_avis": "Produit", "note": 3, "id_ligne": ligne.id_ligne},
        headers=entete_client,
    )

    assert reponse.status_code == 409


def test_lecture_publique_sans_jeton(
    client_http: TestClient,
    entete_client: dict[str, str],
    db: Session,
    client: Client,
) -> None:
    ligne = _ligne(db, client)
    client_http.post(
        AVIS,
        json={"type_avis": "Produit", "note": 5, "id_ligne": ligne.id_ligne},
        headers=entete_client,
    )

    reponse = client_http.get(AVIS)

    assert reponse.status_code == 200
    assert len(reponse.json()) == 1


def test_lecture_filtree_par_ligne(
    client_http: TestClient,
    entete_client: dict[str, str],
    db: Session,
    client: Client,
) -> None:
    ligne_a = _ligne(db, client)
    ligne_b = _ligne(db, client)
    client_http.post(
        AVIS,
        json={"type_avis": "Produit", "note": 5, "id_ligne": ligne_a.id_ligne},
        headers=entete_client,
    )
    client_http.post(
        AVIS,
        json={"type_avis": "Produit", "note": 2, "id_ligne": ligne_b.id_ligne},
        headers=entete_client,
    )

    reponse = client_http.get(AVIS, params={"id_ligne": ligne_a.id_ligne})

    assert reponse.status_code == 200
    corps = reponse.json()
    assert len(corps) == 1
    assert corps[0]["id_ligne"] == ligne_a.id_ligne


def test_obtenir_avis_inexistant_retourne_404(client_http: TestClient) -> None:
    reponse = client_http.get(f"{AVIS}/999")

    assert reponse.status_code == 404


def test_creation_avis_service_sur_sa_reservation(
    client_http: TestClient,
    entete_client: dict[str, str],
    db: Session,
    client: Client,
) -> None:
    reservation = _reservation(db, client)

    reponse = client_http.post(
        AVIS,
        json={
            "type_avis": "Service",
            "note": 4,
            "id_reservation": reservation.id_reservation,
        },
        headers=entete_client,
    )

    assert reponse.status_code == 201
