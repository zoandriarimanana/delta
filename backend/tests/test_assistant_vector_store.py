"""Index vectoriel et indexation de l'assistant IA (Sprint 12), sur PostgreSQL réel.

PGVector écrit par son propre pool de connexions (psycopg 3) : la transaction
annulée de `session_postgres` ne peut pas l'envelopper. Chaque test travaille
donc sur **sa propre collection**, avec de faux embeddings, et la supprime en
sortie — la collection de l'application n'est jamais touchée, et Hugging Face
jamais appelé.

Suppose `alembic upgrade head` (extension `vector`), comme toute la suite.
"""

import uuid
from collections.abc import Iterator

import pytest
from langchain_core.embeddings import DeterministicFakeEmbedding
from langchain_postgres import PGVector
from sqlalchemy.exc import OperationalError

from app.ai_langchain import indexation
from app.ai_langchain.indexation import (
    decouper,
    desindexer_sans_echec,
    indexer_sans_echec,
    indexer_texte,
)
from app.ai_langchain.vector_store import (
    creer_vector_store,
    statistiques,
    supprimer_par_contenu,
    url_psycopg3,
)
from app.core.config import settings
from app.core.database import engine


@pytest.fixture
def store() -> Iterator[PGVector]:
    try:
        engine.connect().close()
    except OperationalError as erreur:
        pytest.skip(f"PostgreSQL injoignable ({erreur.orig}) — test ignoré.")

    store = creer_vector_store(
        DeterministicFakeEmbedding(size=384), f"test_{uuid.uuid4().hex[:12]}"
    )
    try:
        yield store
    finally:
        store.delete_collection()


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+psycopg2://u:p@h:5433/delta",
        "postgresql://u:p@h:5433/delta",
        "postgres://u:p@h:5433/delta",
    ],
)
def test_url_psycopg3_convertit_les_trois_formes(url: str) -> None:
    assert url_psycopg3(url) == "postgresql+psycopg://u:p@h:5433/delta"


def test_url_deja_en_psycopg3_reste_inchangee() -> None:
    url = "postgresql+psycopg://u:p@h:5433/delta"
    assert url_psycopg3(url) == url


def test_decouper_porte_l_origine_et_ecarte_les_fragments_vides() -> None:
    fragments = decouper("Tarte au citron meringuée", "produit", 3)

    assert [f.page_content for f in fragments] == ["Tarte au citron meringuée"]
    assert fragments[0].metadata == {"type_contenu": "produit", "id_contenu": 3}
    assert decouper("   ", "produit", 3) == []
    assert decouper("Tarte", "produit", 3) == [], "moins de 3 mots : du bruit"


def test_decouper_un_long_texte_en_plusieurs_fragments() -> None:
    texte = "\n\n".join(
        f"Paragraphe {n} sur la pâtisserie fine." * 20 for n in range(5)
    )
    assert len(decouper(texte, "formation", 1)) > 1


def test_indexer_puis_retrouver_par_similarite(store: PGVector) -> None:
    assert indexer_texte("produit", 3, "Tarte au citron meringuée", store) == 1

    resultats = store.similarity_search("Tarte au citron meringuée", k=1)

    assert resultats[0].metadata == {"type_contenu": "produit", "id_contenu": 3}


def test_le_titre_voyage_avec_les_fragments(store: PGVector) -> None:
    indexer_texte("produit", 3, "Tarte au citron meringuée", store, titre="Tarte")

    resultat = store.similarity_search("Tarte au citron meringuée", k=1)[0]

    assert resultat.metadata["titre"] == "Tarte"


def test_reindexer_remplace_au_lieu_d_accumuler(store: PGVector) -> None:
    indexer_texte("produit", 3, "Ancienne description de la tarte", store)
    indexer_texte("produit", 3, "Nouvelle description de la tarte", store)

    assert statistiques(store.collection_name) == {"produit": 1}
    contenu = store.similarity_search("tarte", k=5)
    assert [d.page_content for d in contenu] == ["Nouvelle description de la tarte"]


def test_supprimer_une_entite_epargne_les_autres(store: PGVector) -> None:
    indexer_texte("produit", 3, "Tarte au citron meringuée", store)
    indexer_texte("produit", 4, "Pain de campagne au levain", store)
    indexer_texte("formation", 3, "Formation pâtisserie pour débutants", store)

    assert supprimer_par_contenu("produit", 3, store.collection_name) == 1

    assert statistiques(store.collection_name) == {"produit": 1, "formation": 1}


def test_supprimer_tout_un_type(store: PGVector) -> None:
    indexer_texte("produit", 3, "Tarte au citron meringuée", store)
    indexer_texte("produit", 4, "Pain de campagne au levain", store)
    indexer_texte("formation", 3, "Formation pâtisserie pour débutants", store)

    assert supprimer_par_contenu("produit", collection=store.collection_name) == 2
    assert statistiques(store.collection_name) == {"formation": 1}


def test_une_collection_ne_deborde_pas_sur_une_autre(store: PGVector) -> None:
    autre = creer_vector_store(
        DeterministicFakeEmbedding(size=384), f"test_{uuid.uuid4().hex[:12]}"
    )
    try:
        indexer_texte("produit", 3, "Tarte au citron meringuée", store)
        indexer_texte("produit", 3, "Tarte au citron meringuée", autre)

        supprimer_par_contenu("produit", 3, store.collection_name)

        assert statistiques(autre.collection_name) == {"produit": 1}
    finally:
        autre.delete_collection()


def test_collection_inconnue_donne_des_statistiques_vides(store: PGVector) -> None:
    assert statistiques("collection_qui_n_existe_pas") == {}
    assert supprimer_par_contenu("produit", 1, "collection_qui_n_existe_pas") == 0


def test_indexation_desactivee_ne_fait_rien(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_ENABLED", False)

    def construire() -> str:
        raise AssertionError("ne doit pas être appelé quand l'assistant est désactivé")

    assert indexer_sans_echec("produit", 3, construire) == 0
    assert desindexer_sans_echec("produit", 3) == 0


def test_une_panne_d_indexation_ne_remonte_jamais(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """L'action de l'administrateur doit réussir même si l'index est en panne."""
    monkeypatch.setattr(settings, "AI_ENABLED", True)

    def en_panne(*args: object, **kwargs: object) -> int:
        raise ConnectionError("API d'embeddings hors quota")

    monkeypatch.setattr(indexation, "indexer_texte", en_panne)
    monkeypatch.setattr(indexation, "supprimer_par_contenu", en_panne)

    assert indexer_sans_echec("produit", 3, lambda: "Tarte au citron") == 0
    assert desindexer_sans_echec("produit", 3) == 0
    assert "produit#3" in caplog.text


def test_une_entite_mal_formee_ne_remonte_pas_non_plus(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "AI_ENABLED", True)

    def construire() -> str:
        raise AttributeError("relation non chargée")

    assert indexer_sans_echec("produit", 3, construire) == 0
