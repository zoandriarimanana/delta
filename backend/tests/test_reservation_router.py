"""Tests HTTP des réservations, contre PostgreSQL uniquement.

Même contrainte que `test_reservation_service.py` : le `CHECK` d'exclusivité de
`RESERVATION` utilise la syntaxe PostgreSQL `(colonne IS NOT NULL)::int`.

Point de vigilance : `id_client` vient **toujours** du jeton. Un client ne doit
ni lire ni modifier la réservation d'un autre, et la réponse ne doit pas non plus
confirmer qu'elle existe.
"""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
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
from app.models.session_formation import SessionFormation, StatutSessionFormation

pytestmark = pytest.mark.postgres

RESERVATIONS = f"{settings.API_V1_PREFIX}/reservations"
MDP = "motdepasse123"
DEBUT = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
FIN = DEBUT + timedelta(days=4)


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


def _compte(db: Session, prefixe: str = "jean") -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"{prefixe}_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(compte)
    db.commit()
    return compte


def _entete(compte: Client) -> dict[str, str]:
    jeton = creer_jeton_acces(compte.id_client, TypeSujet.CLIENT)
    return {"Authorization": f"Bearer {jeton}"}


@pytest.fixture
def compte(db: Session) -> Client:
    return _compte(db)


@pytest.fixture
def entete(compte: Client) -> dict[str, str]:
    return _entete(compte)


def _session_ouverte(db: Session, capacite: int = 12) -> SessionFormation:
    domaine = DomaineFormation(libelle=f"Domaine {uuid4().hex[:8]}")
    db.add(domaine)
    db.flush()
    formation = Formation(
        titre="CAP Pâtissier",
        duree_heures=140,
        prix=Decimal("850000.00"),
        capacite_max=capacite,
        id_domaine=domaine.id_domaine,
    )
    db.add(formation)
    db.flush()
    formateur = Personnel(
        nom="Rakoto",
        prenom="Jean",
        fonction=FonctionPersonnel.FORMATEUR,
        email=f"formateur_{uuid4().hex[:8]}@delta.mg",
    )
    db.add(formateur)
    db.flush()
    session = SessionFormation(
        date_debut=DEBUT.date(),
        date_fin=FIN.date(),
        places_restantes=capacite,
        statut=StatutSessionFormation.OUVERTE,
        id_formation=formation.id_formation,
        id_formateur=formateur.id_personnel,
    )
    db.add(session)
    db.commit()
    return session


@pytest.fixture
def session_ouverte(db: Session) -> SessionFormation:
    return _session_ouverte(db)


def _corps(id_session: int, nombre: int = 1, **extra: object) -> dict:
    return {
        "type_reservation": "Formation",
        "date_debut": DEBUT.isoformat(),
        "date_fin": FIN.isoformat(),
        "nombre_personnes": nombre,
        "id_session": id_session,
        **extra,
    }


# --- Accès --------------------------------------------------------------------


def test_sans_jeton_tout_est_refuse(
    client_http: TestClient, session_ouverte: SessionFormation
) -> None:
    """Une réservation est un engagement nominatif."""
    assert client_http.get(RESERVATIONS).status_code == 401
    assert (
        client_http.post(
            RESERVATIONS, json=_corps(session_ouverte.id_session)
        ).status_code
        == 401
    )


def test_un_jeton_personnel_n_ouvre_rien(
    client_http: TestClient, db: Session, session_ouverte: SessionFormation
) -> None:
    """Le cloisonnement des deux populations vaut aussi ici."""
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=f"agent_{uuid4().hex[:8]}@delta.mg",
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(agent)
    db.commit()
    jeton = creer_jeton_acces(agent.id_personnel, TypeSujet.PERSONNEL)

    reponse = client_http.get(
        RESERVATIONS, headers={"Authorization": f"Bearer {jeton}"}
    )

    assert reponse.status_code == 401


# --- Création -----------------------------------------------------------------


def test_creation_et_decrement(
    client_http: TestClient,
    entete: dict[str, str],
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    reponse = client_http.post(
        RESERVATIONS, json=_corps(session_ouverte.id_session, nombre=3), headers=entete
    )

    assert reponse.status_code == 201
    assert reponse.json()["statut"] == "En_attente"
    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 9


def test_client_envoye_dans_le_corps_est_ignore(
    client_http: TestClient,
    entete: dict[str, str],
    compte: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """Sinon on réserverait au nom d'autrui."""
    autre = _compte(db, "autre")

    reponse = client_http.post(
        RESERVATIONS,
        json=_corps(session_ouverte.id_session, id_client=autre.id_client),
        headers=entete,
    )

    assert reponse.json()["id_client"] == compte.id_client


def test_places_insuffisantes_retourne_409(
    client_http: TestClient, entete: dict[str, str], db: Session
) -> None:
    session = _session_ouverte(db, capacite=2)

    reponse = client_http.post(
        RESERVATIONS, json=_corps(session.id_session, nombre=5), headers=entete
    )

    assert reponse.status_code == 409
    assert "2" in reponse.json()["detail"]


def test_session_inconnue_retourne_422(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    """422 et non 404 : l'URL est valide, c'est le corps qui ne l'est pas."""
    reponse = client_http.post(RESERVATIONS, json=_corps(99999), headers=entete)

    assert reponse.status_code == 422


def test_session_non_ouverte_retourne_409(
    client_http: TestClient,
    entete: dict[str, str],
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    session_ouverte.statut = StatutSessionFormation.PLANIFIEE
    db.commit()

    reponse = client_http.post(
        RESERVATIONS, json=_corps(session_ouverte.id_session), headers=entete
    )

    assert reponse.status_code == 409


@pytest.mark.parametrize(
    "corps_invalide",
    [
        {"type_reservation": "Formation", "id_session": None},
        {"type_reservation": "Salle"},
        {"type_reservation": "Logement"},
        {"nombre_personnes": 0},
    ],
)
def test_corps_invalide_retourne_422(
    client_http: TestClient,
    entete: dict[str, str],
    session_ouverte: SessionFormation,
    corps_invalide: dict,
) -> None:
    corps = {**_corps(session_ouverte.id_session), **corps_invalide}

    assert client_http.post(RESERVATIONS, json=corps, headers=entete).status_code == 422


# --- Cycle complet ------------------------------------------------------------


def test_cycle_complet_par_http(client_http: TestClient, db: Session) -> None:
    """Le test qui prouve quelque chose, vu du client.

    Dernière place prise, tiers refusé, annulation, tiers accepté.
    """
    session = _session_ouverte(db, capacite=1)
    premier = _compte(db, "premier")
    tiers = _compte(db, "tiers")

    creee = client_http.post(
        RESERVATIONS, json=_corps(session.id_session), headers=_entete(premier)
    )
    assert creee.status_code == 201

    refusee = client_http.post(
        RESERVATIONS, json=_corps(session.id_session), headers=_entete(tiers)
    )
    assert refusee.status_code == 409

    annulee = client_http.put(
        f"{RESERVATIONS}/{creee.json()['id_reservation']}/statut",
        json={"statut": "Annulee"},
        headers=_entete(premier),
    )
    assert annulee.status_code == 200

    reussie = client_http.post(
        RESERVATIONS, json=_corps(session.id_session), headers=_entete(tiers)
    )
    assert reussie.status_code == 201


# --- Isolation entre clients --------------------------------------------------


def test_la_reservation_d_autrui_retourne_404(
    client_http: TestClient, session_ouverte: SessionFormation, db: Session
) -> None:
    """404 et non 403 : confirmer son existence renseignerait déjà."""
    proprietaire = _compte(db, "proprietaire")
    autre = _compte(db, "autre")
    creee = client_http.post(
        RESERVATIONS,
        json=_corps(session_ouverte.id_session),
        headers=_entete(proprietaire),
    ).json()

    reponse = client_http.get(
        f"{RESERVATIONS}/{creee['id_reservation']}", headers=_entete(autre)
    )

    assert reponse.status_code == 404


def test_annuler_la_reservation_d_autrui_retourne_404(
    client_http: TestClient,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """Et surtout : la place ne doit pas être restituée au passage."""
    proprietaire = _compte(db, "proprietaire")
    autre = _compte(db, "autre")
    creee = client_http.post(
        RESERVATIONS,
        json=_corps(session_ouverte.id_session),
        headers=_entete(proprietaire),
    ).json()

    reponse = client_http.put(
        f"{RESERVATIONS}/{creee['id_reservation']}/statut",
        json={"statut": "Annulee"},
        headers=_entete(autre),
    )

    assert reponse.status_code == 404
    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 11


def test_historique_ne_montre_que_ses_propres_reservations(
    client_http: TestClient, session_ouverte: SessionFormation, db: Session
) -> None:
    premier = _compte(db, "premier")
    second = _compte(db, "second")
    client_http.post(
        RESERVATIONS, json=_corps(session_ouverte.id_session), headers=_entete(premier)
    )
    client_http.post(
        RESERVATIONS, json=_corps(session_ouverte.id_session), headers=_entete(second)
    )

    reponse = client_http.get(RESERVATIONS, headers=_entete(premier))

    assert len(reponse.json()) == 1
    assert reponse.json()[0]["id_client"] == premier.id_client
