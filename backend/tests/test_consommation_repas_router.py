"""Tests HTTP de CONSOMMATION_REPAS, contre PostgreSQL uniquement."""

from collections.abc import Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, creer_jeton_acces, hacher_mot_de_passe
from app.main import app
from app.models.abonnement import Abonnement, ModeSuivi, TypeFacturation
from app.models.client import Client, TypeClient
from app.models.client_entreprise import ClientEntreprise
from app.models.personnel import FonctionPersonnel, Personnel

CONSOMMATIONS = f"{settings.API_V1_PREFIX}/consommations"
ADMIN_CONSOMMATIONS = f"{CONSOMMATIONS}/administration"
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


def _entreprise(db: Session, numero: str = "1111111111") -> Client:
    client = Client(
        type_client=TypeClient.ENTREPRISE,
        email=f"{numero}@societe.mg",
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    client.entreprise = ClientEntreprise(
        raison_sociale="Société Test", numero_id_fiscal=numero
    )
    db.add(client)
    db.commit()
    return client


def _abonnement(db: Session, id_client_entreprise: int) -> Abonnement:
    abonnement = Abonnement(
        date_debut=date(2026, 1, 1),
        date_fin=date(2026, 12, 31),
        type_facturation=TypeFacturation.CONSOMMATION_REELLE,
        mode_suivi=ModeSuivi.GLOBAL,
        tarif_unitaire_repas=2500,
        id_client_entreprise=id_client_entreprise,
    )
    db.add(abonnement)
    db.commit()
    return abonnement


def _entete_client(compte: Client) -> dict[str, str]:
    jeton = creer_jeton_acces(compte.id_client, TypeSujet.CLIENT)
    return {"Authorization": f"Bearer {jeton}"}


@pytest.fixture
def entreprise(db: Session) -> Client:
    return _entreprise(db)


@pytest.fixture
def abonnement(db: Session, entreprise: Client) -> Abonnement:
    return _abonnement(db, entreprise.id_client)


@pytest.fixture
def entete_entreprise(entreprise: Client) -> dict[str, str]:
    return _entete_client(entreprise)


@pytest.fixture
def entete_personnel(db: Session) -> dict[str, str]:
    """Salarié non administrateur : l'enregistrement est un geste
    opérationnel, ouvert à tout personnel connecté."""
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


def test_la_route_administration_n_est_pas_captee_par_la_route_parametree(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    """**L'ordre de déclaration, verrouillé.**"""
    reponse = client_http.get(ADMIN_CONSOMMATIONS, headers=entete_admin)

    assert reponse.status_code == 200
    assert reponse.status_code != 422


def test_un_salarie_non_administrateur_peut_enregistrer(
    client_http: TestClient,
    entete_personnel: dict[str, str],
    abonnement: Abonnement,
) -> None:
    reponse = client_http.post(
        CONSOMMATIONS,
        json={
            "date_consommation": "2026-03-01",
            "id_abonnement": abonnement.id_abonnement,
        },
        headers=entete_personnel,
    )

    assert reponse.status_code == 201


def test_un_client_ne_peut_pas_enregistrer(
    client_http: TestClient,
    entete_entreprise: dict[str, str],
    abonnement: Abonnement,
) -> None:
    """L'enregistrement exige un jeton personnel : un client n'a pas ce rôle."""
    reponse = client_http.post(
        CONSOMMATIONS,
        json={
            "date_consommation": "2026-03-01",
            "id_abonnement": abonnement.id_abonnement,
        },
        headers=entete_entreprise,
    )

    assert reponse.status_code == 401


def test_incoherence_mode_suivi_retourne_422(
    client_http: TestClient,
    entete_personnel: dict[str, str],
    abonnement: Abonnement,
) -> None:
    reponse = client_http.post(
        CONSOMMATIONS,
        json={
            "date_consommation": "2026-03-01",
            "id_abonnement": abonnement.id_abonnement,
            "id_beneficiaire": 999,
        },
        headers=entete_personnel,
    )

    assert reponse.status_code == 422


def test_client_voit_ses_consommations(
    client_http: TestClient,
    entete_entreprise: dict[str, str],
    entete_personnel: dict[str, str],
    abonnement: Abonnement,
) -> None:
    client_http.post(
        CONSOMMATIONS,
        json={
            "date_consommation": "2026-03-01",
            "id_abonnement": abonnement.id_abonnement,
        },
        headers=entete_personnel,
    )

    reponse = client_http.get(CONSOMMATIONS, headers=entete_entreprise)

    assert reponse.status_code == 200
    assert len(reponse.json()) == 1


def test_administration_voit_toutes_les_consommations(
    client_http: TestClient,
    entete_personnel: dict[str, str],
    entete_admin: dict[str, str],
    abonnement: Abonnement,
) -> None:
    client_http.post(
        CONSOMMATIONS,
        json={
            "date_consommation": "2026-03-01",
            "id_abonnement": abonnement.id_abonnement,
        },
        headers=entete_personnel,
    )

    reponse = client_http.get(ADMIN_CONSOMMATIONS, headers=entete_admin)

    assert reponse.status_code == 200
    assert len(reponse.json()) == 1
