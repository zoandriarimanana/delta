"""Tests des endpoints d'authentification, montés sur l'application réelle.

L'application de `app/main.py` est utilisée telle quelle — seule la session base
est substituée. C'est délibéré : la traduction des erreurs métier en codes HTTP
vit désormais dans les gestionnaires globaux de `main.py`, donc un test qui
monterait un `FastAPI()` nu ne vérifierait plus les 409 et 401. Le préfixe
d'API est lui aussi exercé au passage.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import decoder_jeton_acces
from app.main import app
from app.models.client import Client
from app.models.client_particulier import ClientParticulier

AUTH = f"{settings.API_V1_PREFIX}/auth"

INSCRIPTION = {
    "email": "jean@example.mg",
    "mot_de_passe": "motdepasse123",
    "telephone": "+261340000000",
    "identite": {"nom": "Rakoto", "prenom": "Jean"},
}


@pytest.fixture
def client_http() -> Iterator[TestClient]:
    # SQLite en mémoire crée une base distincte par connexion, et TestClient
    # exécute les endpoints synchrones dans un thread séparé : sans StaticPool
    # (une seule connexion partagée) la requête HTTP tomberait sur une base
    # vide. `check_same_thread` doit suivre, sqlite3 interdisant par défaut le
    # partage d'une connexion entre threads.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine, tables=[Client.__table__, ClientParticulier.__table__]
    )

    def _get_db() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as testeur:
            yield testeur
    finally:
        # `app` est un singleton de module : sans nettoyage, la substitution
        # fuiterait sur les tests suivants.
        app.dependency_overrides.clear()


def test_inscription_retourne_201_et_le_client(client_http: TestClient) -> None:
    reponse = client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    assert reponse.status_code == 201
    corps = reponse.json()
    assert corps["email"] == "jean@example.mg"
    assert corps["type_client"] == "Particulier"
    assert corps["particulier"]["nom"] == "Rakoto"


def test_inscription_n_expose_jamais_le_mot_de_passe(client_http: TestClient) -> None:
    """Le hash ne doit apparaître sous aucune clé de la réponse."""
    corps = client_http.post(f"{AUTH}/inscription", json=INSCRIPTION).json()

    assert "mot_de_passe" not in corps
    assert "$2b$" not in str(corps)


def test_inscription_en_double_retourne_409(client_http: TestClient) -> None:
    """Vérifie le gestionnaire global `ConflitMetier` → 409."""
    client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    reponse = client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    assert reponse.status_code == 409
    assert "déjà utilisé" in reponse.json()["detail"]


def test_inscription_email_invalide_retourne_422(client_http: TestClient) -> None:
    reponse = client_http.post(
        f"{AUTH}/inscription", json={**INSCRIPTION, "email": "pas-un-email"}
    )

    assert reponse.status_code == 422


def test_inscription_mot_de_passe_trop_court_retourne_422(
    client_http: TestClient,
) -> None:
    reponse = client_http.post(
        f"{AUTH}/inscription", json={**INSCRIPTION, "mot_de_passe": "court"}
    )

    assert reponse.status_code == 422


def test_inscription_mot_de_passe_trop_long_en_octets_retourne_422(
    client_http: TestClient,
) -> None:
    """40 lettres accentuées = 80 octets : rejeté avant d'atteindre bcrypt."""
    reponse = client_http.post(
        f"{AUTH}/inscription", json={**INSCRIPTION, "mot_de_passe": "é" * 40}
    )

    assert reponse.status_code == 422


def test_connexion_retourne_un_jeton_exploitable(client_http: TestClient) -> None:
    inscrit = client_http.post(f"{AUTH}/inscription", json=INSCRIPTION).json()

    reponse = client_http.post(
        f"{AUTH}/connexion",
        json={
            "email": INSCRIPTION["email"],
            "mot_de_passe": INSCRIPTION["mot_de_passe"],
        },
    )

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["token_type"] == "bearer"
    charge_utile = decoder_jeton_acces(corps["access_token"])
    assert charge_utile is not None
    assert charge_utile["sub"] == str(inscrit["id_client"])


def test_connexion_mauvais_mot_de_passe_retourne_401(client_http: TestClient) -> None:
    """Vérifie le gestionnaire global `AuthentificationInvalide` → 401 + en-tête."""
    client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    reponse = client_http.post(
        f"{AUTH}/connexion",
        json={"email": INSCRIPTION["email"], "mot_de_passe": "mauvais_mot_de_passe"},
    )

    assert reponse.status_code == 401
    assert reponse.headers["WWW-Authenticate"] == "Bearer"


def test_connexion_email_inconnu_retourne_401_avec_le_meme_message(
    client_http: TestClient,
) -> None:
    """Message identique aux deux causes de rejet : pas d'énumération de comptes."""
    client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    inconnu = client_http.post(
        f"{AUTH}/connexion",
        json={"email": "inconnu@example.mg", "mot_de_passe": "motdepasse123"},
    )
    mauvais = client_http.post(
        f"{AUTH}/connexion",
        json={"email": INSCRIPTION["email"], "mot_de_passe": "mauvais_mot_de_passe"},
    )

    assert inconnu.status_code == mauvais.status_code == 401
    assert inconnu.json()["detail"] == mauvais.json()["detail"]
