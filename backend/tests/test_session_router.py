"""Tests HTTP de `session_router.py` (`GET /auth/moi`, `POST /auth/deconnexion`).

Ce fichier comble un trou réel : avant le chantier sidebar, ces deux endpoints
n'avaient **aucune** couverture comportementale — seule une assertion
d'inventaire de routes dans `test_main.py` vérifiait que les chemins
existaient, pas ce qu'ils font. `GET /auth/moi` gagne ici `est_administrateur`
(affichage seulement, cf. `app/schemas/auth.py::SessionActive`), l'occasion de
combler le trou plutôt que de l'agrandir.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.cookies import NOM_COOKIE_CSRF, NOM_COOKIE_SESSION
from app.core.database import get_db
from app.core.security import hacher_mot_de_passe
from app.main import app
from app.models.client import Client, TypeClient
from app.models.personnel import FonctionPersonnel, Personnel
from tests.conftest import creer_engine_sqlite

MOI = f"{settings.API_V1_PREFIX}/auth/moi"
DECONNEXION = f"{settings.API_V1_PREFIX}/auth/deconnexion"
CONNEXION_CLIENT = f"{settings.API_V1_PREFIX}/auth/connexion"
CONNEXION_PERSONNEL = f"{settings.API_V1_PREFIX}/auth/personnel/connexion"
MDP = "motdepasse123"


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(Client.__table__, Personnel.__table__)
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
        app.dependency_overrides.clear()


# --- GET /auth/moi --------------------------------------------------------------


def test_moi_refuse_l_anonyme(client_http: TestClient) -> None:
    reponse = client_http.get(MOI)

    assert reponse.status_code == 401


def test_moi_pour_un_client_porte_est_administrateur_a_none(
    client_http: TestClient, db: Session
) -> None:
    """La notion n'existe pas pour un `CLIENT` — `None`, jamais `False`, qui
    laisserait croire à un droit refusé plutôt qu'inapplicable."""
    db.add(
        Client(
            type_client=TypeClient.PARTICULIER,
            email="jean@example.mg",
            mot_de_passe=hacher_mot_de_passe(MDP),
        )
    )
    db.commit()
    client_http.post(
        CONNEXION_CLIENT, json={"email": "jean@example.mg", "mot_de_passe": MDP}
    )

    reponse = client_http.get(MOI)

    assert reponse.status_code == 200
    assert reponse.json() == {"type": "client", "est_administrateur": None}


def test_moi_pour_un_personnel_administrateur_porte_true(
    client_http: TestClient, db: Session
) -> None:
    db.add(
        Personnel(
            nom="Chef",
            prenom="Grand",
            fonction=FonctionPersonnel.AUTRE,
            email="chef@delta.mg",
            est_administrateur=True,
            mot_de_passe=hacher_mot_de_passe(MDP),
        )
    )
    db.commit()
    client_http.post(
        CONNEXION_PERSONNEL, json={"email": "chef@delta.mg", "mot_de_passe": MDP}
    )

    reponse = client_http.get(MOI)

    assert reponse.status_code == 200
    assert reponse.json() == {"type": "personnel", "est_administrateur": True}


def test_moi_pour_un_personnel_non_administrateur_porte_false(
    client_http: TestClient, db: Session
) -> None:
    """**Pas** une absence de champ : `false` explicite, pour que le frontend
    n'ait pas à distinguer « pas encore su » de « pas administrateur »."""
    db.add(
        Personnel(
            nom="Rakoto",
            prenom="Jean",
            fonction=FonctionPersonnel.RECEPTIONNISTE,
            email="jean@delta.mg",
            est_administrateur=False,
            mot_de_passe=hacher_mot_de_passe(MDP),
        )
    )
    db.commit()
    client_http.post(
        CONNEXION_PERSONNEL, json={"email": "jean@delta.mg", "mot_de_passe": MDP}
    )

    reponse = client_http.get(MOI)

    assert reponse.status_code == 200
    assert reponse.json() == {"type": "personnel", "est_administrateur": False}


def test_moi_refuse_un_jeton_invalide(client_http: TestClient) -> None:
    """Un cookie présent mais corrompu se traite comme son absence — 401, pas
    une erreur serveur."""
    reponse = client_http.get(MOI, cookies={NOM_COOKIE_SESSION: "invalide"})

    assert reponse.status_code == 401


# --- POST /auth/deconnexion ------------------------------------------------------


def test_deconnexion_efface_les_cookies_de_session(
    client_http: TestClient, db: Session
) -> None:
    db.add(
        Client(
            type_client=TypeClient.PARTICULIER,
            email="jean@example.mg",
            mot_de_passe=hacher_mot_de_passe(MDP),
        )
    )
    db.commit()
    client_http.post(
        CONNEXION_CLIENT, json={"email": "jean@example.mg", "mot_de_passe": MDP}
    )
    assert client_http.get(MOI).status_code == 200

    # Méthode mutante : le double-submit CSRF exige le jeton posé par la
    # connexion, comme n'importe quelle autre écriture — voir
    # `test_personnel_router.py::test_connexion_personnel_retourne_un_jeton_utilisable`.
    entete = {"X-CSRF-Token": client_http.cookies[NOM_COOKIE_CSRF]}
    reponse = client_http.post(DECONNEXION, headers=entete)

    assert reponse.status_code == 204
    assert NOM_COOKIE_SESSION not in client_http.cookies
    assert NOM_COOKIE_CSRF not in client_http.cookies
    # La session ne survit pas : un appel suivant à `/auth/moi` redevient 401.
    assert client_http.get(MOI).status_code == 401


def test_deconnexion_sans_session_ne_leve_rien(client_http: TestClient) -> None:
    """Effacer un cookie déjà absent est sans effet, pas une erreur — un
    visiteur jamais connecté peut appeler cet endpoint sans crainte."""
    reponse = client_http.post(DECONNEXION)

    assert reponse.status_code == 204
