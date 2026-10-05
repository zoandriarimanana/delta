"""Tests HTTP de l'assistant IA (Sprint 12, 12.4).

La chaîne RAG est remplacée par des fausses : on vérifie ici le contrat HTTP
— codes, format du flux SSE, droits, limite de débit —, pas la qualité des
réponses, couverte par `test_assistant_chaine.py`.
"""

import json
from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.ai_langchain import chaine
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import ServiceIndisponible
from app.core.security import TypeSujet, hacher_mot_de_passe
from app.main import app
from app.models.client import Client, TypeClient
from app.models.personnel import FonctionPersonnel, Personnel
from tests.conftest import authentifier

ASSISTANT = f"{settings.API_V1_PREFIX}/assistant"


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


@pytest.fixture
def actif(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_ENABLED", True)


@pytest.fixture
def chaine_factice(monkeypatch: pytest.MonkeyPatch, actif: None) -> None:
    def repondre(question: str) -> dict:
        return {
            "reponse": f"Réponse à : {question}",
            "sources": [{"type_contenu": "produit", "id_contenu": 3}],
        }

    def repondre_en_flux(question: str, profil=None) -> Iterator[dict]:
        yield {"jeton": "Bon"}
        yield {"jeton": "jour"}
        yield {"fin": True, "sources": [{"type_contenu": "salle", "id_contenu": 1}]}

    monkeypatch.setattr(chaine, "repondre", repondre)
    monkeypatch.setattr(chaine, "repondre_en_flux", repondre_en_flux)


def _evenements(corps: str) -> list[dict]:
    return [
        json.loads(ligne.removeprefix("data: "))
        for ligne in corps.splitlines()
        if ligne.startswith("data: ")
    ]


def _personnel(db: Session, *, administrateur: bool) -> dict[str, str]:
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=FonctionPersonnel.RECEPTIONNISTE,
        email=f"agent_{uuid4().hex[:8]}@delta.mg",
        est_administrateur=administrateur,
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(agent)
    db.commit()
    return authentifier(agent.id_personnel, TypeSujet.PERSONNEL)


# --- Disponibilité ------------------------------------------------------------


def test_disponibilite_reflete_l_activation(
    client_http: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AI_ENABLED", False)
    assert client_http.get(f"{ASSISTANT}/disponibilite").json() == {"actif": False}

    monkeypatch.setattr(settings, "AI_ENABLED", True)
    assert client_http.get(f"{ASSISTANT}/disponibilite").json() == {"actif": True}


# --- Question -----------------------------------------------------------------


def test_question_assistant_coupe_donne_503_avec_retry_after(
    client_http: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AI_ENABLED", False)

    reponse = client_http.post(f"{ASSISTANT}/question", json={"question": "Tartes ?"})

    assert reponse.status_code == 503
    assert reponse.headers["Retry-After"] == "30"
    assert "pas disponible" in reponse.json()["detail"]


def test_question_publique_rend_reponse_et_sources(
    client_http: TestClient, chaine_factice: None
) -> None:
    reponse = client_http.post(
        f"{ASSISTANT}/question", json={"question": "  Avez-vous des tartes ?  "}
    )

    assert reponse.status_code == 200
    assert reponse.json() == {
        "reponse": "Réponse à : Avez-vous des tartes ?",
        "sources": [{"type_contenu": "produit", "id_contenu": 3, "titre": None}],
    }


@pytest.mark.parametrize("question", ["", "    ", "x" * 501])
def test_question_vide_ou_trop_longue_donne_422(
    client_http: TestClient, chaine_factice: None, question: str
) -> None:
    reponse = client_http.post(f"{ASSISTANT}/question", json={"question": question})
    assert reponse.status_code == 422


def test_panne_d_un_fournisseur_donne_503(
    client_http: TestClient, actif: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    def en_panne(question: str) -> dict:
        raise ServiceIndisponible("L'assistant est momentanément indisponible.")

    monkeypatch.setattr(chaine, "repondre", en_panne)

    reponse = client_http.post(f"{ASSISTANT}/question", json={"question": "Tartes ?"})

    assert reponse.status_code == 503


def test_un_client_connecte_peut_aussi_poser_une_question(
    client_http: TestClient, chaine_factice: None, db: Session
) -> None:
    """Le cookie de session déclenche le contrôle CSRF : l'en-tête
    `X-CSRF-Token`, que l'intercepteur axios pose, doit suffire."""
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"jean_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(client)
    db.commit()

    reponse = client_http.post(
        f"{ASSISTANT}/question",
        json={"question": "Tartes ?"},
        headers=authentifier(client.id_client, TypeSujet.CLIENT),
    )

    assert reponse.status_code == 200


# --- Flux SSE -----------------------------------------------------------------


def test_flux_emet_des_evenements_sse(
    client_http: TestClient, chaine_factice: None
) -> None:
    reponse = client_http.post(
        f"{ASSISTANT}/question/flux", json={"question": "Bonjour ?"}
    )

    assert reponse.status_code == 200
    assert reponse.headers["content-type"].startswith("text/event-stream")
    assert reponse.headers["cache-control"] == "no-cache"
    assert _evenements(reponse.text) == [
        {"jeton": "Bon"},
        {"jeton": "jour"},
        {"fin": True, "sources": [{"type_contenu": "salle", "id_contenu": 1}]},
    ]


def test_flux_panne_avant_le_premier_jeton_donne_un_vrai_503(
    client_http: TestClient, actif: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    def en_panne(question: str, profil=None) -> Iterator[dict]:
        raise ServiceIndisponible("Index injoignable.")
        yield {}  # pragma: no cover — fait de la fonction un générateur

    monkeypatch.setattr(chaine, "repondre_en_flux", en_panne)

    reponse = client_http.post(
        f"{ASSISTANT}/question/flux", json={"question": "Tartes ?"}
    )

    assert reponse.status_code == 503


def test_flux_panne_pendant_la_generation_est_signalee_dans_le_flux(
    client_http: TestClient, actif: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    def coupe(question: str, profil=None) -> Iterator[dict]:
        yield {"jeton": "Début"}
        raise ServiceIndisponible("Groq ne répond plus.")

    monkeypatch.setattr(chaine, "repondre_en_flux", coupe)

    reponse = client_http.post(
        f"{ASSISTANT}/question/flux", json={"question": "Tartes ?"}
    )

    assert reponse.status_code == 200, "le code est parti avec le premier jeton"
    assert _evenements(reponse.text) == [
        {"jeton": "Début"},
        {"erreur": "Groq ne répond plus."},
    ]


# --- Limite de débit ------------------------------------------------------------


def test_au_dela_de_dix_questions_par_minute_429(
    client_http: TestClient, chaine_factice: None
) -> None:
    codes = [
        client_http.post(
            f"{ASSISTANT}/question", json={"question": "Tartes ?"}
        ).status_code
        for _ in range(11)
    ]

    assert codes[:10] == [200] * 10
    assert codes[10] == 429


# --- Administration -----------------------------------------------------------


def test_etat_reserve_aux_administrateurs(client_http: TestClient, db: Session) -> None:
    assert client_http.get(f"{ASSISTANT}/administration/etat").status_code == 401
    agent = _personnel(db, administrateur=False)
    assert (
        client_http.get(f"{ASSISTANT}/administration/etat", headers=agent).status_code
        == 403
    )


def test_etat_assistant_coupe_reste_lisible(
    client_http: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un administrateur doit pouvoir constater que l'assistant est coupé."""
    monkeypatch.setattr(settings, "AI_ENABLED", False)

    reponse = client_http.get(
        f"{ASSISTANT}/administration/etat",
        headers=_personnel(db, administrateur=True),
    )

    assert reponse.status_code == 200
    assert reponse.json() == {
        "actif": False,
        "llm_joignable": False,
        "modele_llm": settings.GROQ_MODEL,
        "modele_embeddings": settings.LC_EMBEDDING_MODEL,
        "fragments_par_type": {},
        "total_fragments": 0,
    }


def test_reindexation_reservee_et_503_si_coupe(
    client_http: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AI_ENABLED", False)
    url = f"{ASSISTANT}/administration/reindexation"

    assert client_http.post(url).status_code == 401
    agent = _personnel(db, administrateur=False)
    assert client_http.post(url, headers=agent).status_code == 403
    admin = _personnel(db, administrateur=True)
    assert client_http.post(url, headers=admin).status_code == 503


def test_reindexation_rend_le_compte_par_type(
    client_http: TestClient, db: Session, actif: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.ai_langchain import reindexation

    monkeypatch.setattr(
        reindexation,
        "reindexer_tout",
        lambda db: {
            "produit": {"elements": 2, "fragments": 3},
            "salle": {"elements": 1, "fragments": 1},
        },
    )

    reponse = client_http.post(
        f"{ASSISTANT}/administration/reindexation",
        headers=_personnel(db, administrateur=True),
    )

    assert reponse.status_code == 200
    assert reponse.json()["total_fragments"] == 4
    assert reponse.json()["par_type"]["produit"] == {"elements": 2, "fragments": 3}


def test_panne_pendant_la_reindexation_donne_503(
    client_http: TestClient, db: Session, actif: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.ai_langchain import reindexation

    def en_panne(db: Session) -> dict:
        raise ConnectionError("Hugging Face hors quota")

    monkeypatch.setattr(reindexation, "reindexer_tout", en_panne)

    reponse = client_http.post(
        f"{ASSISTANT}/administration/reindexation",
        headers=_personnel(db, administrateur=True),
    )

    assert reponse.status_code == 503
    assert "incomplet" in reponse.json()["detail"]


# --- Assistant du personnel ----------------------------------------------------


def test_assistant_du_personnel_reserve_au_personnel_connecte(
    client_http: TestClient, db: Session, chaine_factice: None
) -> None:
    url = f"{ASSISTANT}/personnel/question/flux"
    assert client_http.post(url, json={"question": "Étapes ?"}).status_code == 401

    client = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"jean_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(client)
    db.commit()
    jeton_client = authentifier(client.id_client, TypeSujet.CLIENT)
    assert (
        client_http.post(
            url, json={"question": "Étapes ?"}, headers=jeton_client
        ).status_code
        == 401
    ), "un jeton client n'ouvre pas l'assistant du personnel"


def test_assistant_du_personnel_ouvert_a_tout_salarie_avec_le_profil_personnel(
    client_http: TestClient, db: Session, actif: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    profils: list[str] = []

    def repondre_en_flux(question: str, profil=None) -> Iterator[dict]:
        profils.append(profil.nom if profil is not None else "defaut")
        yield {"jeton": "Ouvrez « Catalogue »."}
        yield {"fin": True, "sources": []}

    monkeypatch.setattr(chaine, "repondre_en_flux", repondre_en_flux)
    agent = _personnel(db, administrateur=False)

    reponse = client_http.post(
        f"{ASSISTANT}/personnel/question/flux",
        json={"question": "Comment ajouter un produit ?"},
        headers=agent,
    )

    assert reponse.status_code == 200
    assert _evenements(reponse.text)[0] == {"jeton": "Ouvrez « Catalogue »."}
    assert profils == ["personnel"]


def test_la_bulle_publique_reste_sur_le_profil_client(
    client_http: TestClient, actif: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    profils: list[str] = []

    def repondre_en_flux(question: str, profil=None) -> Iterator[dict]:
        profils.append(profil.nom if profil is not None else "defaut")
        yield {"fin": True, "sources": []}

    monkeypatch.setattr(chaine, "repondre_en_flux", repondre_en_flux)

    client_http.post(f"{ASSISTANT}/question/flux", json={"question": "Tartes ?"})

    assert profils == ["client"]
