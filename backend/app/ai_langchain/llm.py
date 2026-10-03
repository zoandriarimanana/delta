"""LLM de l'assistant : Groq, API distante.

Deux instances, et non une : Groq refuse le streaming combiné au choix d'outil
forcé qu'utilise `with_structured_output()`. Plutôt que de couper le streaming
pour tout le monde, la conversation garde la sienne et les appels structurés
(agentique, 12.7) ont leur propre instance.
"""

from functools import lru_cache

from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import settings
from app.core.exceptions import ServiceIndisponible

# Un visiteur n'attend pas indéfiniment une réponse : au-delà, mieux vaut un
# 503 lisible qu'une requête suspendue. Une seule nouvelle tentative — Groq est
# facturé à l'appel, et une panne réelle ne se résout pas en insistant.
DELAI_MAXIMAL_SECONDES = 30
NOUVELLES_TENTATIVES = 1


def _verifier_cle() -> None:
    if not settings.GROQ_API_KEY:
        raise ServiceIndisponible(
            "L'assistant n'est pas configuré : GROQ_API_KEY est absent."
        )


@lru_cache(maxsize=1)
def obtenir_llm() -> BaseChatModel:
    """LLM de conversation, streaming activé."""
    _verifier_cle()
    from langchain_groq import ChatGroq

    return ChatGroq(
        model=settings.GROQ_MODEL,
        api_key=settings.GROQ_API_KEY,
        temperature=0.3,
        streaming=True,
        timeout=DELAI_MAXIMAL_SECONDES,
        max_retries=NOUVELLES_TENTATIVES,
    )


@lru_cache(maxsize=1)
def obtenir_llm_structure() -> BaseChatModel:
    """LLM sans streaming, pour `with_structured_output()` et les outils."""
    _verifier_cle()
    from langchain_groq import ChatGroq

    return ChatGroq(
        model=settings.GROQ_MODEL,
        api_key=settings.GROQ_API_KEY,
        temperature=0.2,
        streaming=False,
        timeout=DELAI_MAXIMAL_SECONDES,
        max_retries=NOUVELLES_TENTATIVES,
    )


def est_disponible() -> bool:
    """Vrai si Groq répond avec la clé configurée.

    Ne lève jamais : sert à un indicateur d'état, pas à un traitement.
    """
    if not settings.GROQ_API_KEY:
        return False
    try:
        from groq import Groq

        Groq(api_key=settings.GROQ_API_KEY, timeout=10).models.list()
        return True
    except Exception:
        return False
