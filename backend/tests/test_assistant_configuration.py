"""Configuration de l'assistant IA : automatique par défaut, clés exigées si forcé."""

import logging

import pytest
from pydantic import ValidationError

from app.ai_langchain import embeddings, llm
from app.core.config import Settings, settings
from app.core.exceptions import ServiceIndisponible
from app.core.logging import get_logger


@pytest.fixture(autouse=True)
def _fournisseur_hugging_face_par_defaut(monkeypatch: pytest.MonkeyPatch) -> None:
    """Les tests lisent `Settings()`, donc aussi le `.env` du poste : sans ceci,
    un poste réglé sur `EMBEDDINGS_FOURNISSEUR=google` ferait échouer ceux qui
    supposent Hugging Face. Les tests Google le surchargent eux-mêmes."""
    monkeypatch.setenv("EMBEDDINGS_FOURNISSEUR", "huggingface")


def _cles(monkeypatch: pytest.MonkeyPatch, groq: str, hf: str) -> None:
    monkeypatch.setenv("GROQ_API_KEY", groq)
    monkeypatch.setenv("HF_API_TOKEN", hf)


def test_sans_reglage_l_assistant_s_allume_avec_les_deux_cles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Décision du 7 octobre 2026 : toujours allumé dès qu'il peut l'être."""
    _cles(monkeypatch, "gsk_x", "hf_x")

    assert Settings(AI_ENABLED=None).AI_ENABLED is True


@pytest.mark.parametrize(
    ("groq", "hf"), [("", ""), ("gsk_x", ""), ("", "hf_x"), ("gsk_x", "   ")]
)
def test_sans_reglage_ni_cles_l_assistant_reste_eteint_sans_erreur(
    monkeypatch: pytest.MonkeyPatch, groq: str, hf: str
) -> None:
    """Un poste sans clés démarre normalement : automatique n'est pas forcé."""
    _cles(monkeypatch, groq, hf)

    assert Settings(AI_ENABLED=None).AI_ENABLED is False


def test_une_valeur_vide_dans_le_env_vaut_automatique(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`AI_ENABLED=` laissé vide, comme dans `.env.example`, ne bloque pas le
    démarrage."""
    _cles(monkeypatch, "gsk_x", "hf_x")
    monkeypatch.setenv("AI_ENABLED", "")

    assert Settings().AI_ENABLED is True


def test_false_eteint_meme_avec_les_cles(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ce que fait la CI : l'extinction explicite l'emporte toujours."""
    _cles(monkeypatch, "gsk_x", "hf_x")

    assert Settings(AI_ENABLED=False).AI_ENABLED is False


@pytest.mark.parametrize(
    ("cles", "manquantes"),
    [
        ({}, "GROQ_API_KEY, HF_API_TOKEN"),
        ({"GROQ_API_KEY": "gsk_x"}, "HF_API_TOKEN"),
        ({"HF_API_TOKEN": "hf_x", "GROQ_API_KEY": "   "}, "GROQ_API_KEY"),
    ],
)
def test_activer_sans_les_cles_refuse_de_demarrer(
    monkeypatch: pytest.MonkeyPatch, cles: dict[str, str], manquantes: str
) -> None:
    for nom in ("GROQ_API_KEY", "HF_API_TOKEN"):
        monkeypatch.setenv(nom, cles.get(nom, ""))

    with pytest.raises(ValidationError, match=manquantes):
        Settings(AI_ENABLED=True)


def test_activer_avec_les_cles_demarre(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "gsk_x")
    monkeypatch.setenv("HF_API_TOKEN", "hf_x")

    assert Settings(AI_ENABLED=True).AI_ENABLED is True


def test_fournisseurs_sans_cle_levent_service_indisponible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # `settings` est déjà chargé depuis le `.env` du poste : on fige le
    # fournisseur, sans quoi une clé Google renseignée ferait mentir le test.
    monkeypatch.setattr(settings, "EMBEDDINGS_FOURNISSEUR", "huggingface")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "HF_API_TOKEN", "")
    llm.obtenir_llm.cache_clear()
    embeddings.obtenir_embeddings.cache_clear()
    try:
        with pytest.raises(ServiceIndisponible):
            llm.obtenir_llm()
        with pytest.raises(ServiceIndisponible):
            embeddings.obtenir_embeddings()
        assert llm.est_disponible() is False
    finally:
        llm.obtenir_llm.cache_clear()
        embeddings.obtenir_embeddings.cache_clear()


def test_les_loggers_vivent_sous_l_espace_de_noms_delta() -> None:
    journal = get_logger("app.ai_langchain.indexation")

    assert isinstance(journal, logging.Logger)
    assert journal.name == "delta.ai_langchain.indexation"


# --- Fournisseur Google (9 octobre 2026) -----------------------------------------


def test_avec_google_la_cle_exigee_est_celle_de_google(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Avec Gemini, la clé Hugging Face n'est plus nécessaire : c'est
    `GOOGLE_API_KEY` qui conditionne l'allumage automatique."""
    monkeypatch.setenv("EMBEDDINGS_FOURNISSEUR", "google")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_x")
    monkeypatch.setenv("HF_API_TOKEN", "")
    monkeypatch.setenv("GOOGLE_API_KEY", "AIza_x")

    reglages = Settings(AI_ENABLED=None)

    assert reglages.AI_ENABLED is True
    assert reglages.modele_embeddings == "gemini-embedding-001"


def test_google_sans_sa_cle_refuse_de_demarrer_si_force(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EMBEDDINGS_FOURNISSEUR", "google")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_x")
    monkeypatch.setenv("HF_API_TOKEN", "hf_x")
    monkeypatch.setenv("GOOGLE_API_KEY", "")

    with pytest.raises(ValidationError, match="GOOGLE_API_KEY"):
        Settings(AI_ENABLED=True)


def test_l_embedder_google_est_construit_avec_le_modele_et_la_dimension(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "EMBEDDINGS_FOURNISSEUR", "google")
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "AIza_test")
    embeddings.obtenir_embeddings.cache_clear()
    try:
        embedder = embeddings.obtenir_embeddings()
    finally:
        embeddings.obtenir_embeddings.cache_clear()

    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    assert isinstance(embedder, GoogleGenerativeAIEmbeddings)
    assert embedder.model.endswith("gemini-embedding-001")
    assert embedder.output_dimensionality == 768


def test_google_sans_cle_leve_service_indisponible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "EMBEDDINGS_FOURNISSEUR", "google")
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "")
    embeddings.obtenir_embeddings.cache_clear()
    try:
        with pytest.raises(ServiceIndisponible, match="GOOGLE_API_KEY"):
            embeddings.obtenir_embeddings()
    finally:
        embeddings.obtenir_embeddings.cache_clear()
