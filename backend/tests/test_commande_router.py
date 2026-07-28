"""Tests HTTP des endpoints de commande.

Contre PostgreSQL, pour la même raison que `test_commande_service.py` :
`COMMANDE` référence `RESERVATION`, que SQLite ne sait pas créer.

L'application réelle de `app/main.py` est montée — seule la session est
substituée —, ce qui exerce aussi la traduction globale des erreurs métier.
"""

from collections.abc import Iterator
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import creer_jeton_acces, hacher_mot_de_passe
from app.main import app
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.produit import Produit

pytestmark = pytest.mark.postgres

COMMANDES = f"{settings.API_V1_PREFIX}/commandes"


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


def _creer_client(db: Session) -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"cmd_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(compte)
    db.commit()
    return compte


def _entete(compte: Client) -> dict[str, str]:
    return {"Authorization": f"Bearer {creer_jeton_acces(compte.id_client)}"}


@pytest.fixture
def compte(db: Session) -> Client:
    return _creer_client(db)


@pytest.fixture
def entete(compte: Client) -> dict[str, str]:
    return _entete(compte)


@pytest.fixture
def eclair(db: Session) -> Produit:
    categorie = CategorieProduit(libelle=f"Cat {uuid4().hex[:6]}")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Éclair",
        prix_unitaire=Decimal("3.50"),
        unite_mesure="piece",
        stock_disponible=10,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def _corps(id_produit: int, quantite: int = 2) -> dict:
    return {
        "type_commande": "En_ligne",
        "lignes": [{"id_produit": id_produit, "quantite": quantite}],
    }


# --- Protection ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("methode", "chemin"),
    [("post", ""), ("get", ""), ("get", "/1")],
)
def test_endpoints_refuses_sans_jeton(
    client_http: TestClient, methode: str, chemin: str
) -> None:
    reponse = client_http.request(methode, f"{COMMANDES}{chemin}", json={})

    assert reponse.status_code == 401


# --- Création -----------------------------------------------------------------


def test_creation_retourne_201_avec_les_lignes(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    reponse = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit), headers=entete
    )

    assert reponse.status_code == 201
    corps = reponse.json()
    assert corps["statut"] == "En_attente"
    assert Decimal(corps["montant_total"]) == Decimal("7.00")
    assert corps["lignes"][0]["nom_produit"] == "Éclair"
    assert Decimal(corps["lignes"][0]["prix_unitaire_applique"]) == Decimal("3.50")


def test_montant_envoye_par_le_client_est_ignore(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    """Le champ n'existe pas au schema d'entrée : l'envoyer n'a aucun effet."""
    reponse = client_http.post(
        COMMANDES,
        json={**_corps(eclair.id_produit), "montant_total": "0.01", "statut": "Livree"},
        headers=entete,
    )

    corps = reponse.json()
    assert Decimal(corps["montant_total"]) == Decimal("7.00")
    assert corps["statut"] == "En_attente"


def test_produit_inexistant_retourne_422(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    reponse = client_http.post(COMMANDES, json=_corps(99999), headers=entete)

    assert reponse.status_code == 422


def test_stock_insuffisant_retourne_409(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    reponse = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit, quantite=99), headers=entete
    )

    assert reponse.status_code == 409
    assert "Stock insuffisant" in reponse.json()["detail"]
    assert "SQL" not in reponse.text


@pytest.mark.parametrize(
    "corps_invalide",
    [
        {"type_commande": "En_ligne", "lignes": []},
        {"type_commande": "Inconnu", "lignes": [{"id_produit": 1, "quantite": 1}]},
        {"type_commande": "En_ligne", "lignes": [{"id_produit": 1, "quantite": 0}]},
    ],
)
def test_corps_invalide_retourne_422(
    client_http: TestClient, entete: dict[str, str], corps_invalide: dict
) -> None:
    reponse = client_http.post(COMMANDES, json=corps_invalide, headers=entete)

    assert reponse.status_code == 422


# --- Isolation entre clients ---------------------------------------------------


def test_historique_ne_montre_que_ses_propres_commandes(
    client_http: TestClient, db: Session, entete: dict[str, str], eclair: Produit
) -> None:
    client_http.post(COMMANDES, json=_corps(eclair.id_produit), headers=entete)
    autre = _creer_client(db)
    client_http.post(COMMANDES, json=_corps(eclair.id_produit), headers=_entete(autre))

    a_moi = client_http.get(COMMANDES, headers=entete).json()
    a_lui = client_http.get(COMMANDES, headers=_entete(autre)).json()

    assert len(a_moi) == 1
    assert len(a_lui) == 1
    assert a_moi[0]["id_commande"] != a_lui[0]["id_commande"]


def test_commande_dautrui_retourne_404_et_non_403(
    client_http: TestClient, db: Session, entete: dict[str, str], eclair: Produit
) -> None:
    """404 délibérément : un 403 confirmerait que la commande existe.

    C'est le critère central de l'issue #16, vérifié dès maintenant puisque
    l'endpoint est livré ici.
    """
    sienne = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit), headers=entete
    ).json()
    autre = _creer_client(db)

    reponse = client_http.get(
        f"{COMMANDES}/{sienne['id_commande']}", headers=_entete(autre)
    )

    assert reponse.status_code == 404


def test_lecture_de_sa_propre_commande(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    creee = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit), headers=entete
    ).json()

    reponse = client_http.get(f"{COMMANDES}/{creee['id_commande']}", headers=entete)

    assert reponse.status_code == 200
    assert reponse.json()["id_commande"] == creee["id_commande"]
