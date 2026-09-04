"""Tests HTTP de CLIENT_ENTREPRISE (administration)."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, creer_jeton_acces, hacher_mot_de_passe
from app.main import app
from app.models.client import Client, TypeClient
from app.models.client_entreprise import ClientEntreprise
from app.models.personnel import FonctionPersonnel, Personnel
from tests.conftest import creer_engine_sqlite

CLIENTS_ENTREPRISE_ADMIN = f"{settings.API_V1_PREFIX}/clients-entreprise/administration"
MDP = "motdepasse123"


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(
        Client.__table__, ClientEntreprise.__table__, Personnel.__table__
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
        app.dependency_overrides.clear()


def _entreprise(db: Session, numero: str, raison_sociale: str = "Société") -> Client:
    client = Client(
        type_client=TypeClient.ENTREPRISE,
        email=f"{numero}@societe.mg",
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    client.entreprise = ClientEntreprise(
        raison_sociale=raison_sociale, numero_id_fiscal=numero
    )
    db.add(client)
    db.commit()
    return client


@pytest.fixture
def entete_admin(db: Session) -> dict[str, str]:
    admin = Personnel(
        nom="Chef",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email="admin@delta.mg",
        est_administrateur=True,
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(admin)
    db.commit()
    jeton = creer_jeton_acces(admin.id_personnel, TypeSujet.PERSONNEL)
    return {"Authorization": f"Bearer {jeton}"}


@pytest.fixture
def entete_agent(db: Session) -> dict[str, str]:
    """Salarié non administrateur : authentifié, mais sans droit."""
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=FonctionPersonnel.RECEPTIONNISTE,
        email="agent@delta.mg",
        est_administrateur=False,
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(agent)
    db.commit()
    jeton = creer_jeton_acces(agent.id_personnel, TypeSujet.PERSONNEL)
    return {"Authorization": f"Bearer {jeton}"}


def test_endpoint_existe_et_repond(
    client_http: TestClient, entete_admin: dict[str, str], db: Session
) -> None:
    entreprise = _entreprise(db, "1111111111", "Société A")

    reponse = client_http.get(CLIENTS_ENTREPRISE_ADMIN, headers=entete_admin)

    assert reponse.status_code == 200
    corps = reponse.json()
    assert len(corps) == 1
    assert corps[0] == {
        "id_client": entreprise.id_client,
        "raison_sociale": "Société A",
    }


def test_sans_jeton_est_refuse(client_http: TestClient) -> None:
    reponse = client_http.get(CLIENTS_ENTREPRISE_ADMIN)

    assert reponse.status_code == 401


def test_un_salarie_non_administrateur_est_refuse(
    client_http: TestClient, entete_agent: dict[str, str]
) -> None:
    """403 et non 401 : le salarié est identifié, il lui manque un droit."""
    reponse = client_http.get(CLIENTS_ENTREPRISE_ADMIN, headers=entete_agent)

    assert reponse.status_code == 403


def test_un_jeton_client_est_refuse(client_http: TestClient, db: Session) -> None:
    """Réservé au personnel : un jeton client, même valide, n'ouvre rien ici."""
    entreprise = _entreprise(db, "1111111111", "Société A")
    jeton = creer_jeton_acces(entreprise.id_client, TypeSujet.CLIENT)

    reponse = client_http.get(
        CLIENTS_ENTREPRISE_ADMIN, headers={"Authorization": f"Bearer {jeton}"}
    )

    assert reponse.status_code == 401
