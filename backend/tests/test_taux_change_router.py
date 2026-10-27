"""Tests HTTP des taux de change : lecture publique, réglage administrateur."""

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

TAUX = f"{settings.API_V1_PREFIX}/taux-change"


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


def test_la_lecture_est_publique_et_ne_liste_que_les_devises_etrangeres(
    client_http: TestClient,
) -> None:
    reponse = client_http.get(TAUX)

    assert reponse.status_code == 200
    assert {t["devise"] for t in reponse.json()} == {"EUR", "USD"}
    assert set(reponse.json()[0]) == {"devise", "ariary_par_unite", "mis_a_jour_le"}


def test_un_administrateur_regle_un_taux(client_http: TestClient, db: Session) -> None:
    admin = _agent(db, administrateur=True)

    reponse = client_http.put(
        f"{TAUX}/EUR", json={"ariary_par_unite": "5123.5000"}, headers=admin
    )

    assert reponse.status_code == 200
    assert reponse.json()["ariary_par_unite"] == "5123.5000"


def test_un_salarie_sans_droit_recoit_403(client_http: TestClient, db: Session) -> None:
    salarie = _agent(db, administrateur=False)

    reponse = client_http.put(
        f"{TAUX}/EUR", json={"ariary_par_unite": "1"}, headers=salarie
    )

    assert reponse.status_code == 403


def test_sans_session_l_ecriture_est_refusee(client_http: TestClient) -> None:
    reponse = client_http.put(f"{TAUX}/EUR", json={"ariary_par_unite": "1"})

    assert reponse.status_code in (401, 403)


@pytest.mark.parametrize("valeur", ["0", "-5"])
def test_un_taux_non_positif_est_refuse(
    client_http: TestClient, db: Session, valeur: str
) -> None:
    admin = _agent(db, administrateur=True)

    reponse = client_http.put(
        f"{TAUX}/USD", json={"ariary_par_unite": valeur}, headers=admin
    )

    assert reponse.status_code == 422


def test_l_ariary_n_a_pas_de_taux_reglable(
    client_http: TestClient, db: Session
) -> None:
    admin = _agent(db, administrateur=True)

    reponse = client_http.put(
        f"{TAUX}/MGA", json={"ariary_par_unite": "1"}, headers=admin
    )

    assert reponse.status_code == 404
