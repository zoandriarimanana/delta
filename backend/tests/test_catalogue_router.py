"""Tests HTTP des endpoints du catalogue.

Montés sur l'application réelle de `app/main.py`, seule la session étant
substituée : c'est elle qui porte la traduction des erreurs métier en codes
HTTP, qu'un `FastAPI()` nu ne vérifierait pas.

C'est aussi ici que la protection des écritures est exercée de bout en bout —
`get_current_client` n'était couverte qu'unitairement par `test_deps.py`.
"""

from collections.abc import Iterator
from decimal import Decimal

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
from tests.conftest import creer_engine_sqlite

CATEGORIES = f"{settings.API_V1_PREFIX}/categories-produit"
PRODUITS = f"{settings.API_V1_PREFIX}/produits"

PRODUIT_VALIDE = {
    "nom": "Éclair au chocolat",
    "prix_unitaire": "3.50",
    "unite_mesure": "piece",
    "stock_disponible": 10,
}


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(
        Client.__table__, CategorieProduit.__table__, Produit.__table__
    )
    with Session(engine) as session:
        yield session


@pytest.fixture
def client_http(db: Session) -> Iterator[TestClient]:
    def _get_db() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as testeur:
            yield testeur
    finally:
        # `app` est un singleton de module : sans nettoyage, la substitution
        # fuiterait sur les tests suivants.
        app.dependency_overrides.clear()


@pytest.fixture
def entete_authentifie(db: Session) -> dict[str, str]:
    """Jeton d'un client particulier inscrit — aucun rôle particulier."""
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email="jean@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(client)
    db.commit()
    return {"Authorization": f"Bearer {creer_jeton_acces(client.id_client)}"}


@pytest.fixture
def id_categorie(client_http: TestClient, entete_authentifie: dict[str, str]) -> int:
    reponse = client_http.post(
        CATEGORIES, json={"libelle": "Pâtisserie"}, headers=entete_authentifie
    )
    assert reponse.status_code == 201
    return int(reponse.json()["id_categorie"])


# --- Protection des écritures ------------------------------------------------


@pytest.mark.parametrize(
    ("methode", "chemin", "corps"),
    [
        ("post", CATEGORIES, {"libelle": "Boulangerie"}),
        ("put", f"{CATEGORIES}/1", {"libelle": "Boulangerie"}),
        ("delete", f"{CATEGORIES}/1", None),
        ("post", PRODUITS, {**PRODUIT_VALIDE, "id_categorie": 1}),
        ("put", f"{PRODUITS}/1", {"nom": "Autre"}),
        ("delete", f"{PRODUITS}/1", None),
    ],
)
def test_ecritures_refusees_sans_jeton(
    client_http: TestClient, methode: str, chemin: str, corps: dict | None
) -> None:
    """401 sur toute écriture non authentifiée — et non le 403 de HTTPBearer."""
    reponse = client_http.request(methode, chemin, json=corps)

    assert reponse.status_code == 401
    assert reponse.headers["WWW-Authenticate"] == "Bearer"


def test_ecriture_refusee_avec_un_jeton_invalide(client_http: TestClient) -> None:
    reponse = client_http.post(
        CATEGORIES,
        json={"libelle": "Boulangerie"},
        headers={"Authorization": "Bearer pas.un.jeton"},
    )

    assert reponse.status_code == 401


def test_ecriture_acceptee_pour_tout_client_authentifie(
    client_http: TestClient, entete_authentifie: dict[str, str]
) -> None:
    """Aucune vérification de rôle : voir la dette « Sprint 1 » de la roadmap."""
    reponse = client_http.post(
        CATEGORIES, json={"libelle": "Boulangerie"}, headers=entete_authentifie
    )

    assert reponse.status_code == 201


# --- Lectures publiques ------------------------------------------------------


def test_lectures_publiques(client_http: TestClient, id_categorie: int) -> None:
    for chemin in (CATEGORIES, f"{CATEGORIES}/{id_categorie}", PRODUITS):
        assert client_http.get(chemin).status_code == 200


def test_lecture_dune_categorie_inconnue_retourne_404(client_http: TestClient) -> None:
    """404 : la ressource est bien désignée par l'URL."""
    assert client_http.get(f"{CATEGORIES}/99999").status_code == 404


def test_lecture_dun_produit_inconnu_retourne_404(client_http: TestClient) -> None:
    assert client_http.get(f"{PRODUITS}/99999").status_code == 404


# --- Règles métier -----------------------------------------------------------


def test_categorie_en_double_retourne_409(
    client_http: TestClient, entete_authentifie: dict[str, str], id_categorie: int
) -> None:
    reponse = client_http.post(
        CATEGORIES, json={"libelle": "Pâtisserie"}, headers=entete_authentifie
    )

    assert reponse.status_code == 409


def test_produit_avec_categorie_inexistante_retourne_422(
    client_http: TestClient, entete_authentifie: dict[str, str]
) -> None:
    """422 et jamais 404 : la référence est dans le corps, pas dans l'URL."""
    reponse = client_http.post(
        PRODUITS,
        json={**PRODUIT_VALIDE, "id_categorie": 99999},
        headers=entete_authentifie,
    )

    assert reponse.status_code == 422


@pytest.mark.parametrize(
    "champ_invalide",
    [{"prix_unitaire": "-1.00"}, {"stock_disponible": -5}, {"nom": ""}],
)
def test_valeurs_invalides_retournent_422(
    client_http: TestClient,
    entete_authentifie: dict[str, str],
    id_categorie: int,
    champ_invalide: dict,
) -> None:
    reponse = client_http.post(
        PRODUITS,
        json={**PRODUIT_VALIDE, "id_categorie": id_categorie, **champ_invalide},
        headers=entete_authentifie,
    )

    assert reponse.status_code == 422


def test_suppression_dune_categorie_referencee_retourne_409(
    client_http: TestClient, entete_authentifie: dict[str, str], id_categorie: int
) -> None:
    """Message métier, pas une trace SQL — la FK est en ON DELETE RESTRICT."""
    client_http.post(
        PRODUITS,
        json={**PRODUIT_VALIDE, "id_categorie": id_categorie},
        headers=entete_authentifie,
    )

    reponse = client_http.delete(
        f"{CATEGORIES}/{id_categorie}", headers=entete_authentifie
    )

    assert reponse.status_code == 409
    assert "contient encore des produits" in reponse.json()["detail"]
    assert "SQL" not in reponse.text and "IntegrityError" not in reponse.text


# --- Filtre par catégorie ----------------------------------------------------


def test_filtre_par_categorie(
    client_http: TestClient, entete_authentifie: dict[str, str], id_categorie: int
) -> None:
    autre = client_http.post(
        CATEGORIES, json={"libelle": "Confiture"}, headers=entete_authentifie
    ).json()["id_categorie"]
    client_http.post(
        PRODUITS,
        json={**PRODUIT_VALIDE, "id_categorie": id_categorie},
        headers=entete_authentifie,
    )
    client_http.post(
        PRODUITS,
        json={**PRODUIT_VALIDE, "nom": "Confiture de letchi", "id_categorie": autre},
        headers=entete_authentifie,
    )

    tout = client_http.get(PRODUITS).json()
    filtre = client_http.get(PRODUITS, params={"id_categorie": id_categorie}).json()

    assert len(tout) == 2
    assert [p["nom"] for p in filtre] == ["Éclair au chocolat"]


def test_filtre_sur_categorie_inconnue_retourne_liste_vide(
    client_http: TestClient, id_categorie: int
) -> None:
    assert client_http.get(PRODUITS, params={"id_categorie": 99999}).json() == []


# --- Cycle complet -----------------------------------------------------------


def test_cycle_complet_sur_un_produit(
    client_http: TestClient, entete_authentifie: dict[str, str], id_categorie: int
) -> None:
    cree = client_http.post(
        PRODUITS,
        json={**PRODUIT_VALIDE, "id_categorie": id_categorie},
        headers=entete_authentifie,
    ).json()

    modifie = client_http.put(
        f"{PRODUITS}/{cree['id_produit']}",
        json={"prix_unitaire": "4.25"},
        headers=entete_authentifie,
    ).json()
    assert Decimal(modifie["prix_unitaire"]) == Decimal("4.25")
    assert modifie["nom"] == PRODUIT_VALIDE["nom"], "mise a jour partielle attendue"

    suppression = client_http.delete(
        f"{PRODUITS}/{cree['id_produit']}", headers=entete_authentifie
    )
    assert suppression.status_code == 204
    assert client_http.get(f"{PRODUITS}/{cree['id_produit']}").status_code == 404
