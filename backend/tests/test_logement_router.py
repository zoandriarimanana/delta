"""Tests HTTP du catalogue des logements, contre PostgreSQL uniquement."""

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
from app.models.personnel import FonctionPersonnel, Personnel

pytestmark = pytest.mark.postgres

LOGEMENTS = f"{settings.API_V1_PREFIX}/logements"
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


def _jeton_personnel(db: Session, *, administrateur: bool) -> dict[str, str]:
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=FonctionPersonnel.RECEPTIONNISTE,
        email=f"agent_{uuid4().hex[:8]}@delta.mg",
        est_administrateur=administrateur,
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(agent)
    db.commit()
    jeton = creer_jeton_acces(agent.id_personnel, TypeSujet.PERSONNEL)
    return {"Authorization": f"Bearer {jeton}"}


@pytest.fixture
def entete_admin(db: Session) -> dict[str, str]:
    return _jeton_personnel(db, administrateur=True)


@pytest.fixture
def entete_agent(db: Session) -> dict[str, str]:
    return _jeton_personnel(db, administrateur=False)


@pytest.fixture
def entete_client(db: Session) -> dict[str, str]:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"jean_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(client)
    db.commit()
    jeton = creer_jeton_acces(client.id_client, TypeSujet.CLIENT)
    return {"Authorization": f"Bearer {jeton}"}


def _corps(**extra: object) -> dict:
    return {
        "type_chambre": "Double",
        "capacite": 2,
        "tarif_nuitee": "45000.00",
        **extra,
    }


# --- Accès --------------------------------------------------------------------


def test_les_lectures_sont_publiques(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    creee = client_http.post(LOGEMENTS, json=_corps(), headers=entete_admin).json()

    assert client_http.get(LOGEMENTS).status_code == 200
    assert client_http.get(f"{LOGEMENTS}/{creee['id_logement']}").status_code == 200


def test_sans_jeton_les_ecritures_sont_refusees(client_http: TestClient) -> None:
    assert client_http.post(LOGEMENTS, json=_corps()).status_code == 401


def test_un_jeton_client_ne_permet_pas_d_ecrire(
    client_http: TestClient, entete_client: dict[str, str]
) -> None:
    reponse = client_http.post(LOGEMENTS, json=_corps(), headers=entete_client)

    assert reponse.status_code == 401


def test_un_salarie_sans_droit_recoit_403(
    client_http: TestClient, entete_agent: dict[str, str]
) -> None:
    reponse = client_http.post(LOGEMENTS, json=_corps(), headers=entete_agent)

    assert reponse.status_code == 403


# --- Statut -------------------------------------------------------------------


def test_creation_naît_disponible(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    reponse = client_http.post(LOGEMENTS, json=_corps(), headers=entete_admin)

    assert reponse.status_code == 201
    assert reponse.json()["statut"] == "Disponible"


def test_statut_envoye_a_la_creation_est_ignore(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    reponse = client_http.post(
        LOGEMENTS, json=_corps(statut="Hors_service"), headers=entete_admin
    )

    assert reponse.json()["statut"] == "Disponible"


def test_statut_hors_domaine_retourne_422(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    """« Occupe » n'existe pas : l'occupation se déduit des réservations."""
    creee = client_http.post(LOGEMENTS, json=_corps(), headers=entete_admin).json()

    reponse = client_http.put(
        f"{LOGEMENTS}/{creee['id_logement']}",
        json={"statut": "Occupe"},
        headers=entete_admin,
    )

    assert reponse.status_code == 422


@pytest.mark.parametrize("statut", ["En_maintenance", "Hors_service", "Disponible"])
def test_changement_de_statut(
    client_http: TestClient, entete_admin: dict[str, str], statut: str
) -> None:
    creee = client_http.post(LOGEMENTS, json=_corps(), headers=entete_admin).json()

    reponse = client_http.put(
        f"{LOGEMENTS}/{creee['id_logement']}",
        json={"statut": statut},
        headers=entete_admin,
    )

    assert reponse.status_code == 200
    assert reponse.json()["statut"] == statut


# --- Bornes et filtres --------------------------------------------------------


@pytest.mark.parametrize(
    "surcharge",
    [
        {"capacite": 0},
        {"capacite": -2},
        {"tarif_nuitee": "-1.00"},
        {"type_chambre": ""},
    ],
)
def test_bornes_invalides_retournent_422(
    client_http: TestClient, entete_admin: dict[str, str], surcharge: dict
) -> None:
    reponse = client_http.post(
        LOGEMENTS, json=_corps(**surcharge), headers=entete_admin
    )

    assert reponse.status_code == 422


def test_filtres_combines(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    client_http.post(LOGEMENTS, json=_corps(capacite=1), headers=entete_admin)
    client_http.post(LOGEMENTS, json=_corps(capacite=6), headers=entete_admin)

    reponse = client_http.get(
        LOGEMENTS, params={"statut": "Disponible", "capacite_minimale": 4}
    )

    assert reponse.status_code == 200
    assert len(reponse.json()) == 1


def test_combinaison_sans_resultat_donne_une_liste_vide(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    client_http.post(LOGEMENTS, json=_corps(), headers=entete_admin)

    reponse = client_http.get(LOGEMENTS, params={"capacite_minimale": 100})

    assert reponse.status_code == 200
    assert reponse.json() == []


def test_statut_de_filtre_hors_domaine_retourne_422(client_http: TestClient) -> None:
    assert client_http.get(LOGEMENTS, params={"statut": "Occupe"}).status_code == 422


# --- Archivage et restauration ------------------------------------------------


def test_archivage_puis_invisibilite(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    creee = client_http.post(LOGEMENTS, json=_corps(), headers=entete_admin).json()

    assert (
        client_http.delete(
            f"{LOGEMENTS}/{creee['id_logement']}", headers=entete_admin
        ).status_code
        == 204
    )
    assert client_http.get(f"{LOGEMENTS}/{creee['id_logement']}").status_code == 404


def test_hors_service_reste_visible(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    """Archiver n'est pas mettre hors service.

    Le premier retire la ligne des lectures, le second dit que le bien existe
    mais n'est pas louable.
    """
    creee = client_http.post(LOGEMENTS, json=_corps(), headers=entete_admin).json()
    client_http.put(
        f"{LOGEMENTS}/{creee['id_logement']}",
        json={"statut": "Hors_service"},
        headers=entete_admin,
    )

    assert client_http.get(f"{LOGEMENTS}/{creee['id_logement']}").status_code == 200


def test_restauration(client_http: TestClient, entete_admin: dict[str, str]) -> None:
    creee = client_http.post(LOGEMENTS, json=_corps(), headers=entete_admin).json()
    client_http.delete(f"{LOGEMENTS}/{creee['id_logement']}", headers=entete_admin)

    reponse = client_http.post(
        f"{LOGEMENTS}/{creee['id_logement']}/restauration", headers=entete_admin
    )

    assert reponse.status_code == 200


def test_obtenir_inconnu_retourne_404(client_http: TestClient) -> None:
    assert client_http.get(f"{LOGEMENTS}/99999").status_code == 404
