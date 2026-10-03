"""Configuration de l'assistant IA (Sprint 12) : défaut fermé, clés exigées."""

import logging

import pytest
from pydantic import ValidationError

from app.ai_langchain import embeddings, llm
from app.core.config import Settings, settings
from app.core.exceptions import ServiceIndisponible
from app.core.logging import get_logger


def test_l_assistant_est_desactive_par_defaut() -> None:
    """Défaut fermé : un déploiement qui omet la variable n'appelle personne."""
    assert Settings.model_fields["AI_ENABLED"].default is False


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
