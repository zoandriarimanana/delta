"""Tests HTTP de ABONNEMENT, contre PostgreSQL uniquement.

Même contrainte que `test_reservation_router.py` : `ABONNEMENT` porte une
contrainte d'exclusion `EXCLUDE USING gist`, que SQLite ne sait pas créer.
"""

from collections.abc import Iterator
from uuid import uuid4

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

ABONNEMENTS = f"{settings.API_V1_PREFIX}/abonnements"
ADMIN_ABONNEMENTS = f"{ABONNEMENTS}/administration"
MDP = "motdepasse123"

CHARGE_UTILE = {
    "date_debut": "2026-01-01",
    "date_fin": "2026-12-31",
    "type_facturation": "Forfait",
    "mode_suivi": "Global",
    "tarif_forfait": "500000",
}


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
        email=f"{numero}_{uuid4().hex[:8]}@societe.mg",
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    client.entreprise = ClientEntreprise(
        raison_sociale="Société Test", numero_id_fiscal=numero
    )
    db.add(client)
    db.commit()
    return client


def _entete(compte: Client) -> dict[str, str]:
    jeton = creer_jeton_acces(compte.id_client, TypeSujet.CLIENT)
    return {"Authorization": f"Bearer {jeton}"}


@pytest.fixture
def entreprise(db: Session) -> Client:
    return _entreprise(db)


@pytest.fixture
def entete_entreprise(entreprise: Client) -> dict[str, str]:
    return _entete(entreprise)


@pytest.fixture
def entete_admin(db: Session) -> dict[str, str]:
    admin = Personnel(
        nom="Chef",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=f"admin_{uuid4().hex[:8]}@delta.mg",
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
    """**L'ordre de déclaration, verrouillé.**

    `/abonnements/administration` et `/abonnements/{id_abonnement}` ont la
    même forme. Si la route paramétrée était déclarée en premier,
    `administration` serait interprété comme un identifiant et l'appel
    donnerait un **422** — sur une route qui existe pourtant.
    """
    reponse = client_http.get(ADMIN_ABONNEMENTS, headers=entete_admin)

    assert reponse.status_code == 200
    assert reponse.status_code != 422


def test_creation_par_l_entreprise(
    client_http: TestClient, entete_entreprise: dict[str, str]
) -> None:
    reponse = client_http.post(
        ABONNEMENTS, json=CHARGE_UTILE, headers=entete_entreprise
    )

    assert reponse.status_code == 201
    assert reponse.json()["type_facturation"] == "Forfait"


def test_l_abonnement_d_une_autre_entreprise_retourne_404(
    client_http: TestClient, entete_entreprise: dict[str, str], db: Session
) -> None:
    autre = _entreprise(db, "2222222222")
    autre_abonnement = client_http.post(
        ABONNEMENTS, json=CHARGE_UTILE, headers=_entete(autre)
    ).json()

    reponse = client_http.get(
        f"{ABONNEMENTS}/{autre_abonnement['id_abonnement']}",
        headers=entete_entreprise,
    )

    assert reponse.status_code == 404


def test_chevauchement_retourne_409(
    client_http: TestClient, entete_entreprise: dict[str, str]
) -> None:
    client_http.post(ABONNEMENTS, json=CHARGE_UTILE, headers=entete_entreprise)

    reponse = client_http.post(
        ABONNEMENTS,
        json={**CHARGE_UTILE, "date_debut": "2026-06-01", "date_fin": "2027-06-01"},
        headers=entete_entreprise,
    )

    assert reponse.status_code == 409


def test_administration_voit_tous_les_abonnements(
    client_http: TestClient,
    entete_entreprise: dict[str, str],
    entete_admin: dict[str, str],
) -> None:
    client_http.post(ABONNEMENTS, json=CHARGE_UTILE, headers=entete_entreprise)

    reponse = client_http.get(ADMIN_ABONNEMENTS, headers=entete_admin)

    assert reponse.status_code == 200
    assert len(reponse.json()) >= 1


def test_suppression_refusee_si_un_beneficiaire_actif_couvre_l_abonnement(
    client_http: TestClient,
    entete_entreprise: dict[str, str],
    entete_admin: dict[str, str],
) -> None:
    """Bout en bout : POST /abonnements → POST /beneficiaires → DELETE
    /abonnements/administration/{id} doit répondre 409, pas seulement au
    niveau service."""
    abonnement = client_http.post(
        ABONNEMENTS, json=CHARGE_UTILE, headers=entete_entreprise
    ).json()
    client_http.post(
        f"{settings.API_V1_PREFIX}/beneficiaires",
        json={
            "id_abonnement": abonnement["id_abonnement"],
            "nom": "Rakoto",
            "prenom": "Jean",
            "identifiant_badge": "B001",
        },
        headers=entete_entreprise,
    )

    reponse = client_http.delete(
        f"{ADMIN_ABONNEMENTS}/{abonnement['id_abonnement']}", headers=entete_admin
    )

    assert reponse.status_code == 409


def test_suppression_acceptee_sans_beneficiaire(
    client_http: TestClient,
    entete_entreprise: dict[str, str],
    entete_admin: dict[str, str],
) -> None:
    abonnement = client_http.post(
        ABONNEMENTS, json=CHARGE_UTILE, headers=entete_entreprise
    ).json()

    reponse = client_http.delete(
        f"{ADMIN_ABONNEMENTS}/{abonnement['id_abonnement']}", headers=entete_admin
    )

    assert reponse.status_code == 204
