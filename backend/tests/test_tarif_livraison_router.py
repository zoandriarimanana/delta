"""Tests HTTP du tarif de livraison : lecture publique, réglage administrateur."""

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, hacher_mot_de_passe
from app.main import app
from app.models.personnel import FonctionPersonnel, Personnel
from tests.conftest import authentifier

TARIF = f"{settings.API_V1_PREFIX}/tarif-livraison"


@pytest.fixture
def db(session_postgres: Session) -> Session:
    session_postgres.expire_on_commit = False  # comme `SessionLocal`
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


def _agent(db: Session, *, administrateur: bool) -> dict[str, str]:
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=f"agent_{uuid4().hex[:8]}@delta.mg",
        est_administrateur=administrateur,
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(agent)
    db.commit()
    return authentifier(agent.id_personnel, TypeSujet.PERSONNEL)


def test_la_lecture_est_publique(client_http: TestClient) -> None:
    reponse = client_http.get(TARIF)

    assert reponse.status_code == 200
    assert set(reponse.json()) == {"forfait", "seuil_gratuite"}


def test_un_administrateur_regle_le_tarif(client_http: TestClient, db: Session) -> None:
    admin = _agent(db, administrateur=True)

    reponse = client_http.put(
        TARIF, json={"forfait": "4000.00", "seuil_gratuite": None}, headers=admin
    )

    assert reponse.status_code == 200
    assert reponse.json() == {"forfait": "4000.00", "seuil_gratuite": None}
    assert client_http.get(TARIF).json()["forfait"] == "4000.00"


def test_un_salarie_sans_droit_recoit_403(client_http: TestClient, db: Session) -> None:
    salarie = _agent(db, administrateur=False)

    reponse = client_http.put(TARIF, json={"forfait": "0.00"}, headers=salarie)

    assert reponse.status_code == 403


def test_sans_session_l_ecriture_est_refusee(client_http: TestClient) -> None:
    assert client_http.put(TARIF, json={"forfait": "0.00"}).status_code in (401, 403)


@pytest.mark.parametrize(
    "corps",
    [{"forfait": "-1.00"}, {"seuil_gratuite": "0.00"}, {"forfait": "abc"}],
)
def test_un_montant_incoherent_retourne_422(
    client_http: TestClient, db: Session, corps: dict
) -> None:
    admin = _agent(db, administrateur=True)

    assert client_http.put(TARIF, json=corps, headers=admin).status_code == 422
