"""Tests HTTP du catalogue des salles, contre PostgreSQL uniquement.

`RESERVATION` est nécessaire au pré-contrôle d'archivage, et son `CHECK`
d'exclusivité utilise une syntaxe que SQLite refuse.

Le réglage d'accès est celui des autres catalogues : lectures publiques,
écritures administrateur.
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
from app.models.personnel import FonctionPersonnel, Personnel

pytestmark = pytest.mark.postgres

SALLES = f"{settings.API_V1_PREFIX}/salles"
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
        "nom": f"Salle {uuid4().hex[:6]}",
        "capacite": 20,
        "tarif_horaire": "15000.00",
        **extra,
    }


# --- Accès --------------------------------------------------------------------


def test_les_lectures_sont_publiques(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    creee = client_http.post(SALLES, json=_corps(), headers=entete_admin).json()

    assert client_http.get(SALLES).status_code == 200
    assert client_http.get(f"{SALLES}/{creee['id_salle']}").status_code == 200


def test_sans_jeton_les_ecritures_sont_refusees(client_http: TestClient) -> None:
    assert client_http.post(SALLES, json=_corps()).status_code == 401


def test_un_jeton_client_ne_permet_pas_d_ecrire(
    client_http: TestClient, entete_client: dict[str, str]
) -> None:
    """401 : la revendication `type` ne correspond pas, on ne sait pas qui appelle."""
    assert (
        client_http.post(SALLES, json=_corps(), headers=entete_client).status_code
        == 401
    )


def test_un_salarie_sans_droit_recoit_403(
    client_http: TestClient, entete_agent: dict[str, str]
) -> None:
    """403 : le salarié est identifié, il lui manque un droit."""
    assert (
        client_http.post(SALLES, json=_corps(), headers=entete_agent).status_code == 403
    )


# --- Le CHECK des tarifs ------------------------------------------------------


def test_salle_sans_tarif_retourne_422(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    corps = {"nom": "Sans tarif", "capacite": 20}

    reponse = client_http.post(SALLES, json=corps, headers=entete_admin)

    assert reponse.status_code == 422


def test_gratuite_explicite_acceptee(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    """`0.00` passe : la gratuité est une décision, pas une absence."""
    reponse = client_http.post(
        SALLES, json=_corps(tarif_horaire="0.00"), headers=entete_admin
    )

    assert reponse.status_code == 201
    assert reponse.json()["tarif_horaire"] == "0.00"


def test_retirer_le_dernier_tarif_retourne_422(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    creee = client_http.post(SALLES, json=_corps(), headers=entete_admin).json()

    reponse = client_http.put(
        f"{SALLES}/{creee['id_salle']}",
        json={"tarif_horaire": None},
        headers=entete_admin,
    )

    assert reponse.status_code == 422


def test_retirer_un_tarif_si_l_autre_reste(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    creee = client_http.post(
        SALLES, json=_corps(tarif_journee="90000.00"), headers=entete_admin
    ).json()

    reponse = client_http.put(
        f"{SALLES}/{creee['id_salle']}",
        json={"tarif_horaire": None},
        headers=entete_admin,
    )

    assert reponse.status_code == 200
    assert reponse.json()["tarif_horaire"] is None
    assert reponse.json()["tarif_journee"] == "90000.00"


# --- Bornes et filtres --------------------------------------------------------


@pytest.mark.parametrize(
    "surcharge",
    [{"capacite": 0}, {"capacite": -5}, {"tarif_horaire": "-1.00"}, {"nom": ""}],
)
def test_bornes_invalides_retournent_422(
    client_http: TestClient, entete_admin: dict[str, str], surcharge: dict
) -> None:
    reponse = client_http.post(SALLES, json=_corps(**surcharge), headers=entete_admin)

    assert reponse.status_code == 422


def test_filtre_par_capacite(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    client_http.post(SALLES, json=_corps(capacite=10), headers=entete_admin)
    client_http.post(SALLES, json=_corps(capacite=50), headers=entete_admin)

    reponse = client_http.get(SALLES, params={"capacite_minimale": 30})

    assert reponse.status_code == 200
    assert len(reponse.json()) == 1


def test_capacite_inatteignable_donne_une_liste_vide(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    client_http.post(SALLES, json=_corps(), headers=entete_admin)

    reponse = client_http.get(SALLES, params={"capacite_minimale": 1000})

    assert reponse.status_code == 200
    assert reponse.json() == []


def test_capacite_minimale_negative_retourne_422(client_http: TestClient) -> None:
    assert client_http.get(SALLES, params={"capacite_minimale": 0}).status_code == 422


# --- Archivage et restauration ------------------------------------------------


def test_archivage_puis_invisibilite(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    creee = client_http.post(SALLES, json=_corps(), headers=entete_admin).json()

    assert (
        client_http.delete(
            f"{SALLES}/{creee['id_salle']}", headers=entete_admin
        ).status_code
        == 204
    )
    assert client_http.get(f"{SALLES}/{creee['id_salle']}").status_code == 404


def test_restauration(client_http: TestClient, entete_admin: dict[str, str]) -> None:
    creee = client_http.post(SALLES, json=_corps(), headers=entete_admin).json()
    client_http.delete(f"{SALLES}/{creee['id_salle']}", headers=entete_admin)

    reponse = client_http.post(
        f"{SALLES}/{creee['id_salle']}/restauration", headers=entete_admin
    )

    assert reponse.status_code == 200
    assert client_http.get(f"{SALLES}/{creee['id_salle']}").status_code == 200


def test_obtenir_inconnue_retourne_404(client_http: TestClient) -> None:
    assert client_http.get(f"{SALLES}/99999").status_code == 404
