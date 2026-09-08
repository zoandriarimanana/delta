"""Rate limiting sur les deux endpoints de connexion (dette technique T0.6).

Application réelle (`app/main.py`), comme `test_auth_router.py` : la
traduction `RateLimitExceeded` → 429 vit dans les gestionnaires globaux, un
`FastAPI()` nu ne l'exercerait pas.

Le limiteur (`app.core.rate_limit.limiter`) est un singleton de process,
réinitialisé avant chaque test par l'autofixture de `conftest.py` — sans quoi
les deux tests ci-dessous, qui épuisent chacun leur limite, interféreraient
l'un avec l'autre selon l'ordre d'exécution.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.rate_limit import LIMITE_CONNEXION
from app.main import app
from app.models.client import Client
from app.models.client_entreprise import ClientEntreprise
from app.models.client_particulier import ClientParticulier
from app.models.personnel import Personnel

AUTH = f"{settings.API_V1_PREFIX}/auth"

#: `"5/minute"` -> 5. Extrait de la constante plutôt que recopié en dur : un
#: changement de limite dans `rate_limit.py` ne doit pas faire mentir ce test.
NOMBRE_AUTORISE = int(LIMITE_CONNEXION.split("/")[0])


@pytest.fixture
def client_http() -> Iterator[TestClient]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine,
        tables=[
            Client.__table__,
            ClientParticulier.__table__,
            ClientEntreprise.__table__,
            Personnel.__table__,
        ],
    )

    def _get_db() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as testeur:
            yield testeur
    finally:
        app.dependency_overrides.clear()


def _tenter_connexion_client(client_http: TestClient) -> int:
    return client_http.post(
        f"{AUTH}/connexion",
        json={"email": "inconnu@example.mg", "mot_de_passe": "peu_importe"},
    ).status_code


def _tenter_connexion_personnel(client_http: TestClient) -> int:
    return client_http.post(
        f"{AUTH}/personnel/connexion",
        json={"email": "inconnu@delta.mg", "mot_de_passe": "peu_importe"},
    ).status_code


def test_connexion_client_bloquee_au_dela_de_la_limite(client_http: TestClient) -> None:
    """Les `NOMBRE_AUTORISE` premières tentatives échouent normalement (401,
    identifiants inconnus) ; celle d'après est bloquée par le rate limiting
    (429), avant même d'atteindre `AuthService`."""
    statuts = [_tenter_connexion_client(client_http) for _ in range(NOMBRE_AUTORISE)]
    assert statuts == [401] * NOMBRE_AUTORISE

    reponse_en_trop = client_http.post(
        f"{AUTH}/connexion",
        json={"email": "inconnu@example.mg", "mot_de_passe": "peu_importe"},
    )

    assert reponse_en_trop.status_code == 429
    assert "detail" in reponse_en_trop.json()


def test_connexion_personnel_bloquee_au_dela_de_la_limite(
    client_http: TestClient,
) -> None:
    """Même garde, endpoint distinct — et bucket distinct : voir
    `test_les_deux_endpoints_ont_des_limites_independantes`."""
    statuts = [_tenter_connexion_personnel(client_http) for _ in range(NOMBRE_AUTORISE)]
    assert statuts == [401] * NOMBRE_AUTORISE

    reponse_en_trop = client_http.post(
        f"{AUTH}/personnel/connexion",
        json={"email": "inconnu@delta.mg", "mot_de_passe": "peu_importe"},
    )

    assert reponse_en_trop.status_code == 429


def test_les_deux_endpoints_ont_des_limites_independantes(
    client_http: TestClient,
) -> None:
    """Épuiser la limite du client ne doit pas affecter celle du personnel —
    ce sont deux décorateurs distincts, pas un seul budget partagé par IP."""
    for _ in range(NOMBRE_AUTORISE):
        _tenter_connexion_client(client_http)
    assert _tenter_connexion_client(client_http) == 429

    # Le personnel, même adresse IP, n'a encore rien consommé de son budget.
    assert _tenter_connexion_personnel(client_http) == 401


def test_le_message_429_ne_fuit_pas_le_vocabulaire_de_la_bibliotheque(
    client_http: TestClient,
) -> None:
    """`slowapi` répond par défaut `{"error": "Rate limit exceeded: ..."}` —
    le gestionnaire de `main.py` doit reprendre le vocabulaire `{"detail": ...}`
    du reste de l'API, pas le laisser passer tel quel."""
    for _ in range(NOMBRE_AUTORISE):
        _tenter_connexion_client(client_http)

    reponse = client_http.post(
        f"{AUTH}/connexion",
        json={"email": "inconnu@example.mg", "mot_de_passe": "peu_importe"},
    )

    corps = reponse.json()
    assert "error" not in corps
    assert corps["detail"]
