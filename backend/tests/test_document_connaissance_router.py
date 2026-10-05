"""Tests HTTP de la base de connaissances de l'assistant (Sprint 12, 12.9).

Vrais service et base (`session_postgres`) ; l'indexation, elle, est
interceptée — on vérifie qu'elle est demandée, avec la bonne **audience**, sans
appeler Hugging Face.
"""

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.ai_langchain import indexation, vector_store
from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, hacher_mot_de_passe
from app.main import app
from app.models.document_connaissance import DocumentConnaissance
from app.models.personnel import FonctionPersonnel, Personnel
from tests.conftest import authentifier

DOCUMENTS = f"{settings.API_V1_PREFIX}/assistant/administration/documents"


@pytest.fixture
def db(session_postgres: Session) -> Session:
    session_postgres.expire_on_commit = False  # comme `SessionLocal`
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


class Indexations:
    def __init__(self) -> None:
        self.appels: list[tuple] = []

    def indexer(self, type_contenu, id_contenu, construire, titre=None, audience="?"):
        self.appels.append(
            ("indexer", type_contenu, id_contenu, audience, construire())
        )
        return 2

    def desindexer(self, type_contenu, id_contenu):
        self.appels.append(("desindexer", type_contenu, id_contenu))
        return 2


@pytest.fixture
def indexations(monkeypatch: pytest.MonkeyPatch) -> Indexations:
    journal = Indexations()
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(indexation, "indexer_sans_echec", journal.indexer)
    monkeypatch.setattr(indexation, "desindexer_sans_echec", journal.desindexer)
    # Compte des fragments : 2 pour chaque document indexé, comme la fausse
    # indexation ci-dessus le prétend.
    monkeypatch.setattr(
        vector_store,
        "compter_par_contenu",
        lambda type_contenu: {a[2]: 2 for a in journal.appels if a[0] == "indexer"},
    )
    return journal


def _personnel(db: Session, *, administrateur: bool) -> tuple[int, dict[str, str]]:
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=f"agent_{uuid4().hex[:8]}@delta.mg",
        est_administrateur=administrateur,
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(agent)
    db.commit()
    return agent.id_personnel, authentifier(agent.id_personnel, TypeSujet.PERSONNEL)


def _televerser(client_http, entetes, *, public="Client", contenu=None, nom="faq.txt"):
    return client_http.post(
        DOCUMENTS,
        headers=entetes,
        data={"titre": "Foire aux questions", "public_cible": public},
        files={"fichier": (nom, contenu or b"Livraison le mardi.", "text/plain")},
    )


def test_reserve_aux_administrateurs(client_http: TestClient, db: Session) -> None:
    assert client_http.get(DOCUMENTS).status_code == 401
    _, agent = _personnel(db, administrateur=False)
    assert client_http.get(DOCUMENTS, headers=agent).status_code == 403
    assert _televerser(client_http, agent).status_code == 403


def test_assistant_coupe_le_televersement_repond_503(
    client_http: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AI_ENABLED", False)
    _, admin = _personnel(db, administrateur=True)

    assert _televerser(client_http, admin).status_code == 503


def test_televerser_enregistre_le_texte_et_l_indexe_pour_les_clients(
    client_http: TestClient, db: Session, indexations: Indexations
) -> None:
    id_admin, admin = _personnel(db, administrateur=True)

    reponse = _televerser(client_http, admin)

    assert reponse.status_code == 201
    corps = reponse.json()
    assert corps["titre"] == "Foire aux questions"
    assert corps["type_fichier"] == "txt"
    assert corps["public_cible"] == "Client"
    assert corps["id_personnel"] == id_admin, "l'auteur vient du jeton"
    assert corps["apercu"] == "Livraison le mardi."
    assert corps["nombre_fragments"] == 2
    assert "texte_extrait" not in corps
    [appel] = indexations.appels
    assert appel[:2] == ("indexer", "document")
    assert appel[3] == "client"
    assert "Livraison le mardi." in appel[4]
    enregistre = db.get(DocumentConnaissance, corps["id_document"])
    assert enregistre.texte_extrait == "Livraison le mardi."


def test_un_document_du_personnel_est_indexe_pour_le_personnel(
    client_http: TestClient, db: Session, indexations: Indexations
) -> None:
    _, admin = _personnel(db, administrateur=True)

    _televerser(client_http, admin, public="Personnel")

    assert indexations.appels[0][3] == "personnel"


def test_un_public_inconnu_est_refuse(
    client_http: TestClient, db: Session, indexations: Indexations
) -> None:
    _, admin = _personnel(db, administrateur=True)

    assert _televerser(client_http, admin, public="client").status_code == 422
    assert indexations.appels == []


def test_un_fichier_refuse_n_est_ni_enregistre_ni_indexe(
    client_http: TestClient, db: Session, indexations: Indexations
) -> None:
    _, admin = _personnel(db, administrateur=True)

    reponse = _televerser(client_http, admin, contenu=b"MZ\x90binaire", nom="virus.pdf")

    assert reponse.status_code == 400
    assert "Format non pris en charge" in reponse.json()["detail"]
    assert indexations.appels == []
    assert client_http.get(DOCUMENTS, headers=admin).json() == []


def test_archiver_retire_de_l_index_et_restaurer_y_remet(
    client_http: TestClient, db: Session, indexations: Indexations
) -> None:
    _, admin = _personnel(db, administrateur=True)
    id_document = _televerser(client_http, admin).json()["id_document"]
    indexations.appels.clear()

    assert (
        client_http.delete(f"{DOCUMENTS}/{id_document}", headers=admin).status_code
        == 204
    )
    assert client_http.get(DOCUMENTS, headers=admin).json() == []
    archives = client_http.get(
        DOCUMENTS, headers=admin, params={"inclure_archives": True}
    ).json()
    assert [d["id_document"] for d in archives] == [id_document]

    reponse = client_http.post(f"{DOCUMENTS}/{id_document}/restauration", headers=admin)

    assert reponse.status_code == 200
    assert [a[0] for a in indexations.appels] == ["desindexer", "indexer"]


def test_document_introuvable_404(
    client_http: TestClient, db: Session, indexations: Indexations
) -> None:
    _, admin = _personnel(db, administrateur=True)

    assert (
        client_http.delete(f"{DOCUMENTS}/999999999", headers=admin).status_code == 404
    )
