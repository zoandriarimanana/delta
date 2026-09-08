"""Tests HTTP des sessions de formation.

Deux points de vigilance.

**Le réglage d'accès** : lectures publiques, écritures administrateur — les
dates d'une session font partie de ce qu'un visiteur vient consulter.

**La confidentialité du formateur** : `FormateurPublic` porte nom, prénom et
spécialité, jamais l'adresse professionnelle ni le téléphone. La frontière est
tracée ailleurs que pour le livreur en #25, et pour une raison métier — un
formateur exerce publiquement, ses coordonnées restent internes.
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
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.personnel import FonctionPersonnel, Personnel
from app.models.session_formation import SessionFormation
from tests.conftest import creer_engine_sqlite

DOMAINES = f"{settings.API_V1_PREFIX}/domaines-formation"
FORMATIONS = f"{settings.API_V1_PREFIX}/formations"
SESSIONS = f"{settings.API_V1_PREFIX}/sessions-formation"
MDP = "motdepasse123"

NOM_FORMATEUR = "Randriamampionona"
EMAIL_FORMATEUR = "solofo.formateur@delta.mg"
TEL_FORMATEUR = "+261340999888"


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(
        Client.__table__,
        Personnel.__table__,
        DomaineFormation.__table__,
        Formation.__table__,
        SessionFormation.__table__,
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


@pytest.fixture
def entete_admin(db: Session) -> dict[str, str]:
    admin = Personnel(
        nom="Chef",
        prenom="Grand",
        fonction=FonctionPersonnel.AUTRE,
        email=f"admin_{uuid4().hex[:8]}@delta.mg",
        est_administrateur=True,
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(admin)
    db.commit()
    jeton = creer_jeton_acces(admin.id_personnel, TypeSujet.PERSONNEL)
    return {"Authorization": f"Bearer {jeton}"}


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


@pytest.fixture
def formateur(db: Session) -> Personnel:
    """Formateur aux coordonnées reconnaissables, pour traquer les fuites."""
    personnel = Personnel(
        nom=NOM_FORMATEUR,
        prenom="Solofo",
        fonction=FonctionPersonnel.FORMATEUR,
        email=EMAIL_FORMATEUR,
        telephone=TEL_FORMATEUR,
        specialite="Entremets",
    )
    db.add(personnel)
    db.commit()
    return personnel


@pytest.fixture
def id_formation(client_http: TestClient, entete_admin: dict[str, str]) -> int:
    domaine = client_http.post(
        DOMAINES, json={"libelle": "Pâtisserie"}, headers=entete_admin
    ).json()
    reponse = client_http.post(
        FORMATIONS,
        json={
            "titre": "CAP Pâtissier",
            "duree_heures": 140,
            "prix": "850000.00",
            "capacite_max": 12,
            "id_domaine": domaine["id_domaine"],
        },
        headers=entete_admin,
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["id_formation"]


def _corps(id_formation: int, **extra: object) -> dict:
    return {
        "date_debut": "2026-09-01",
        "date_fin": "2026-09-05",
        "id_formation": id_formation,
        **extra,
    }


@pytest.fixture
def id_session(
    client_http: TestClient, entete_admin: dict[str, str], id_formation: int
) -> int:
    reponse = client_http.post(
        SESSIONS, json=_corps(id_formation), headers=entete_admin
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["id_session"]


# --- Accès --------------------------------------------------------------------


def test_les_lectures_sont_publiques(client_http: TestClient, id_session: int) -> None:
    assert client_http.get(SESSIONS).status_code == 200
    assert client_http.get(f"{SESSIONS}/{id_session}").status_code == 200


def test_sans_jeton_les_ecritures_sont_refusees(
    client_http: TestClient, id_formation: int
) -> None:
    assert client_http.post(SESSIONS, json=_corps(id_formation)).status_code == 401


def test_un_jeton_client_ne_permet_pas_d_ecrire(
    client_http: TestClient, entete_client: dict[str, str], id_formation: int
) -> None:
    reponse = client_http.post(
        SESSIONS, json=_corps(id_formation), headers=entete_client
    )

    assert reponse.status_code == 401


# --- Confidentialité du formateur ---------------------------------------------


def test_le_formateur_expose_nom_prenom_et_specialite(
    client_http: TestClient,
    entete_admin: dict[str, str],
    id_session: int,
    formateur: Personnel,
) -> None:
    """Le nom est un argument commercial : il décide un client à s'inscrire."""
    client_http.put(
        f"{SESSIONS}/{id_session}/formateur",
        json={"id_personnel": formateur.id_personnel},
        headers=entete_admin,
    )

    corps = client_http.get(f"{SESSIONS}/{id_session}").json()

    assert corps["formateur"] == {
        "nom": NOM_FORMATEUR,
        "prenom": "Solofo",
        "specialite": "Entremets",
    }


def test_le_formateur_ne_divulgue_ni_email_ni_telephone(
    client_http: TestClient,
    entete_admin: dict[str, str],
    id_session: int,
    formateur: Personnel,
) -> None:
    """Les publier exposerait un salarié au démarchage sans qu'il l'ait choisi.

    La lecture est **publique** : c'est le corps brut qu'on inspecte, pas
    seulement les clés du dictionnaire.
    """
    client_http.put(
        f"{SESSIONS}/{id_session}/formateur",
        json={"id_personnel": formateur.id_personnel},
        headers=entete_admin,
    )

    reponse = client_http.get(f"{SESSIONS}/{id_session}")

    brut = reponse.text
    assert EMAIL_FORMATEUR not in brut
    assert TEL_FORMATEUR not in brut
    for interdit in ("email", "telephone", "est_administrateur", "date_embauche"):
        assert interdit not in reponse.json()["formateur"]


def test_sans_formateur_le_champ_est_nul(
    client_http: TestClient, id_session: int
) -> None:
    """« Pas encore affecté » n'est pas une information utile au visiteur."""
    assert client_http.get(f"{SESSIONS}/{id_session}").json()["formateur"] is None


# --- Cohérence de fonction ----------------------------------------------------


def test_affecter_un_non_formateur_retourne_422(
    client_http: TestClient,
    entete_admin: dict[str, str],
    id_session: int,
    db: Session,
) -> None:
    """Rien en base ne l'empêche : c'est le mécanisme partagé qui refuse."""
    livreur = Personnel(
        nom="Rabe",
        prenom="Paul",
        fonction=FonctionPersonnel.LIVREUR,
        email=f"livreur_{uuid4().hex[:8]}@delta.mg",
    )
    db.add(livreur)
    db.commit()

    reponse = client_http.put(
        f"{SESSIONS}/{id_session}/formateur",
        json={"id_personnel": livreur.id_personnel},
        headers=entete_admin,
    )

    assert reponse.status_code == 422
    assert "Livreur" in reponse.json()["detail"]
    assert "session de formation" in reponse.json()["detail"]


def test_affecter_un_inconnu_retourne_422(
    client_http: TestClient, entete_admin: dict[str, str], id_session: int
) -> None:
    reponse = client_http.put(
        f"{SESSIONS}/{id_session}/formateur",
        json={"id_personnel": 99999},
        headers=entete_admin,
    )

    assert reponse.status_code == 422


# --- Création et cycle de vie -------------------------------------------------


def test_places_initialisees_depuis_la_capacite(
    client_http: TestClient, entete_admin: dict[str, str], id_formation: int
) -> None:
    reponse = client_http.post(
        SESSIONS, json=_corps(id_formation), headers=entete_admin
    )

    assert reponse.json()["places_restantes"] == 12
    assert reponse.json()["statut"] == "Planifiee"


def test_places_envoyees_par_le_client_sont_ignorees(
    client_http: TestClient, entete_admin: dict[str, str], id_formation: int
) -> None:
    """Sinon on ouvrirait mille places sur une formation qui en compte douze."""
    reponse = client_http.post(
        SESSIONS,
        json=_corps(id_formation, places_restantes=1000, statut="Ouverte"),
        headers=entete_admin,
    )

    assert reponse.json()["places_restantes"] == 12
    assert reponse.json()["statut"] == "Planifiee"


def test_formation_inconnue_retourne_422(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    reponse = client_http.post(SESSIONS, json=_corps(99999), headers=entete_admin)

    assert reponse.status_code == 422


def test_dates_inversees_retournent_422(
    client_http: TestClient, entete_admin: dict[str, str], id_formation: int
) -> None:
    reponse = client_http.post(
        SESSIONS,
        json=_corps(id_formation, date_fin="2026-08-01"),
        headers=entete_admin,
    )

    assert reponse.status_code == 422


def test_ouvrir_sans_formateur_retourne_409(
    client_http: TestClient, entete_admin: dict[str, str], id_session: int
) -> None:
    reponse = client_http.put(
        f"{SESSIONS}/{id_session}/statut",
        json={"statut": "Ouverte"},
        headers=entete_admin,
    )

    assert reponse.status_code == 409


def test_session_terminee_retourne_409(
    client_http: TestClient,
    entete_admin: dict[str, str],
    id_session: int,
    formateur: Personnel,
) -> None:
    client_http.put(
        f"{SESSIONS}/{id_session}/statut",
        json={"statut": "Terminee"},
        headers=entete_admin,
    )

    reponse = client_http.put(
        f"{SESSIONS}/{id_session}/formateur",
        json={"id_personnel": formateur.id_personnel},
        headers=entete_admin,
    )

    assert reponse.status_code == 409


def test_filtre_par_formation(
    client_http: TestClient, id_session: int, id_formation: int
) -> None:
    reponse = client_http.get(SESSIONS, params={"id_formation": id_formation})

    assert reponse.status_code == 200
    assert len(reponse.json()) == 1


def test_filtre_sur_une_formation_inconnue_donne_une_liste_vide(
    client_http: TestClient,
) -> None:
    reponse = client_http.get(SESSIONS, params={"id_formation": 99999})

    assert reponse.status_code == 200
    assert reponse.json() == []


# --- Garde-fou reporté depuis #34 ---------------------------------------------


def test_archiver_une_formation_avec_sessions_retourne_409(
    client_http: TestClient,
    entete_admin: dict[str, str],
    id_formation: int,
    id_session: int,
) -> None:
    reponse = client_http.delete(f"{FORMATIONS}/{id_formation}", headers=entete_admin)

    assert reponse.status_code == 409
