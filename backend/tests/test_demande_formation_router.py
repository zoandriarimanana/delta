"""Formation sur commande (14 octobre 2026)."""

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, hacher_mot_de_passe
from app.main import app
from app.models.client import Client, TypeClient
from app.models.demande_formation import DemandeFormation
from app.models.personnel import FonctionPersonnel, Personnel
from tests.conftest import authentifier

pytestmark = pytest.mark.postgres

DEMANDES = f"{settings.API_V1_PREFIX}/demandes-formation"
CORPS = {
    "sujet": "Décoration de gâteaux en pâte à sucre",
    "nombre_participants": 6,
    "niveau": "Débutant",
    "periode_souhaitee": "Novembre, en semaine",
    "lieu": "Chez_delta",
    "message": "Pour l'équipe d'une boulangerie.",
    "nom_contact": "Hery Rakoto",
    "contact": "034 12 345 67",
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


def _personnel(db: Session, admin: bool) -> dict[str, str]:
    salarie = Personnel(
        nom="Admin",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=f"p_{uuid4().hex[:8]}@delta.mg",
        est_administrateur=admin,
        mot_de_passe=hacher_mot_de_passe("MotDePasse123!"),
    )
    db.add(salarie)
    db.commit()
    return authentifier(salarie.id_personnel, TypeSujet.PERSONNEL)


def test_un_visiteur_envoie_une_demande_et_recoit_un_simple_accuse(
    client_http: TestClient, db: Session
) -> None:
    reponse = client_http.post(DEMANDES, json=CORPS)

    assert reponse.status_code == 201
    accuse = reponse.json()
    # Ce qu'il vient de saisir ne lui est pas renvoyé.
    assert set(accuse) == {"id_demande", "date_demande"}
    demande = db.get(DemandeFormation, accuse["id_demande"])
    assert demande.statut.value == "Nouvelle"
    assert demande.id_client is None


def test_un_client_connecte_est_rattache_d_apres_sa_session(
    client_http: TestClient, db: Session
) -> None:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"c_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("MotDePasse123!"),
    )
    db.add(compte)
    db.commit()

    reponse = client_http.post(
        DEMANDES,
        json={**CORPS, "id_client": 999, "statut": "Planifiee"},
        headers=authentifier(compte.id_client, TypeSujet.CLIENT),
    )

    demande = db.get(DemandeFormation, reponse.json()["id_demande"])
    assert demande.id_client == compte.id_client
    assert demande.statut.value == "Nouvelle"


@pytest.mark.parametrize(
    "champ", [{"sujet": ""}, {"nombre_participants": 0}, {"contact": "12"}]
)
def test_une_demande_incomplete_est_refusee(
    client_http: TestClient, champ: dict
) -> None:
    assert client_http.post(DEMANDES, json={**CORPS, **champ}).status_code == 422


def test_l_administration_liste_et_suit_les_demandes(
    client_http: TestClient, db: Session
) -> None:
    id_demande = client_http.post(DEMANDES, json=CORPS).json()["id_demande"]
    entete = _personnel(db, admin=True)

    liste = client_http.get(f"{DEMANDES}/administration", headers=entete).json()
    assert liste[0]["id_demande"] == id_demande
    assert liste[0]["contact"] == "034 12 345 67"

    suivi = client_http.put(
        f"{DEMANDES}/administration/{id_demande}",
        json={"statut": "En_discussion", "note_interne": "Rappeler jeudi."},
        headers=entete,
    )
    assert suivi.status_code == 200
    assert suivi.json()["statut"] == "En_discussion"
    assert suivi.json()["note_interne"] == "Rappeler jeudi."


def test_les_demandes_sont_fermees_au_public_et_aux_salaries_sans_droit(
    client_http: TestClient, db: Session
) -> None:
    assert client_http.get(f"{DEMANDES}/administration").status_code == 401
    assert (
        client_http.get(
            f"{DEMANDES}/administration", headers=_personnel(db, admin=False)
        ).status_code
        == 403
    )


def test_une_demande_archivee_disparait_de_la_liste(
    client_http: TestClient, db: Session
) -> None:
    id_demande = client_http.post(DEMANDES, json=CORPS).json()["id_demande"]
    entete = _personnel(db, admin=True)

    assert (
        client_http.delete(
            f"{DEMANDES}/administration/{id_demande}", headers=entete
        ).status_code
        == 204
    )
    ids = [
        d["id_demande"]
        for d in client_http.get(f"{DEMANDES}/administration", headers=entete).json()
    ]
    assert id_demande not in ids


def test_l_envoi_est_limite_par_adresse(client_http: TestClient) -> None:
    """Formulaire public : au-delà de 5 envois par minute, 429."""
    codes = [client_http.post(DEMANDES, json=CORPS).status_code for _ in range(6)]

    assert codes[:5] == [201] * 5
    assert codes[5] == 429
