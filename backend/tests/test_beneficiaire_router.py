"""Tests HTTP de BENEFICIAIRE, contre PostgreSQL uniquement.

Même contrainte que `test_abonnement_router.py` : `ABONNEMENT`, référencé par
`BENEFICIAIRE`, porte une contrainte d'exclusion `EXCLUDE USING gist` que
SQLite ne sait pas créer.
"""

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

BENEFICIAIRES = f"{settings.API_V1_PREFIX}/beneficiaires"
ADMIN_BENEFICIAIRES = f"{BENEFICIAIRES}/administration"
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
        type_facturation=TypeFacturation.FORFAIT,
        mode_suivi=ModeSuivi.INDIVIDUEL,
        tarif_forfait=500000,
        id_client_entreprise=id_client_entreprise,
    )
    db.add(abonnement)
    db.commit()
    return abonnement


def _entete(compte: Client) -> dict[str, str]:
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
    return _entete(entreprise)


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


def _charge_utile(id_abonnement: int, badge: str = "B001") -> dict:
    return {
        "id_abonnement": id_abonnement,
        "nom": "Rakoto",
        "prenom": "Jean",
        "identifiant_badge": badge,
    }


def test_la_route_administration_n_est_pas_captee_par_la_route_parametree(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    """**L'ordre de déclaration, verrouillé.**

    `/beneficiaires/administration` et `/beneficiaires/{id_beneficiaire}` ont
    la même forme. Si la route paramétrée était déclarée en premier,
    `administration` serait interprété comme un identifiant et l'appel
    donnerait un **422** — sur une route qui existe pourtant.
    """
    reponse = client_http.get(ADMIN_BENEFICIAIRES, headers=entete_admin)

    assert reponse.status_code == 200
    assert reponse.status_code != 422


def test_creation_par_l_entreprise(
    client_http: TestClient,
    entete_entreprise: dict[str, str],
    abonnement: Abonnement,
) -> None:
    reponse = client_http.post(
        BENEFICIAIRES,
        json=_charge_utile(abonnement.id_abonnement),
        headers=entete_entreprise,
    )

    assert reponse.status_code == 201
    assert reponse.json()["identifiant_badge"] == "B001"


def test_creation_sur_l_abonnement_d_une_autre_entreprise_retourne_404(
    client_http: TestClient, entete_entreprise: dict[str, str], db: Session
) -> None:
    autre = _entreprise(db, "2222222222")
    abonnement_autre = _abonnement(db, autre.id_client)

    reponse = client_http.post(
        BENEFICIAIRES,
        json=_charge_utile(abonnement_autre.id_abonnement),
        headers=entete_entreprise,
    )

    assert reponse.status_code == 404


def test_administration_voit_tous_les_beneficiaires(
    client_http: TestClient,
    entete_entreprise: dict[str, str],
    entete_admin: dict[str, str],
    abonnement: Abonnement,
) -> None:
    client_http.post(
        BENEFICIAIRES,
        json=_charge_utile(abonnement.id_abonnement),
        headers=entete_entreprise,
    )

    reponse = client_http.get(ADMIN_BENEFICIAIRES, headers=entete_admin)

    assert reponse.status_code == 200
    assert len(reponse.json()) == 1


def test_administration_sans_filtre_voit_tous_les_abonnements(
    client_http: TestClient,
    entete_entreprise: dict[str, str],
    entete_admin: dict[str, str],
    abonnement: Abonnement,
    db: Session,
) -> None:
    """Sans `id_abonnement` : comportement inchangé, aucune régression."""
    autre = _entreprise(db, "2222222222")
    abonnement_autre = _abonnement(db, autre.id_client)
    client_http.post(
        BENEFICIAIRES,
        json=_charge_utile(abonnement.id_abonnement, "B001"),
        headers=entete_entreprise,
    )
    client_http.post(
        BENEFICIAIRES,
        json=_charge_utile(abonnement_autre.id_abonnement, "B002"),
        headers=_entete(autre),
    )

    reponse = client_http.get(ADMIN_BENEFICIAIRES, headers=entete_admin)

    assert reponse.status_code == 200
    assert len(reponse.json()) == 2


def test_administration_avec_filtre_ne_voit_que_l_abonnement_designe(
    client_http: TestClient,
    entete_entreprise: dict[str, str],
    entete_admin: dict[str, str],
    abonnement: Abonnement,
    db: Session,
) -> None:
    autre = _entreprise(db, "2222222222")
    abonnement_autre = _abonnement(db, autre.id_client)
    client_http.post(
        BENEFICIAIRES,
        json=_charge_utile(abonnement.id_abonnement, "B001"),
        headers=entete_entreprise,
    )
    client_http.post(
        BENEFICIAIRES,
        json=_charge_utile(abonnement_autre.id_abonnement, "B002"),
        headers=_entete(autre),
    )

    reponse = client_http.get(
        ADMIN_BENEFICIAIRES,
        params={"id_abonnement": abonnement.id_abonnement},
        headers=entete_admin,
    )

    assert reponse.status_code == 200
    corps = reponse.json()
    assert len(corps) == 1
    assert corps[0]["identifiant_badge"] == "B001"
