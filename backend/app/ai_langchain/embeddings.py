"""Embeddings de l'assistant : Hugging Face, Google Gemini ou Jina AI, au choix.

Toujours un fournisseur **distant**, jamais un modèle local : la cible de
déploiement (Render) doit rester légère, sans `torch`. Modèles multilingues,
le contenu étant en français et parfois en malgache.

Le fournisseur se choisit par `EMBEDDINGS_FOURNISSEUR` (`.env`). Google a été
ajouté le 9 octobre 2026, quand le compte Hugging Face n'avait plus de
crédits ; Jina le 12 octobre, quand Google a refusé l'accès au projet.
Changer de fournisseur impose une réindexation complète : les
vecteurs de deux modèles ne se comparent pas.
"""

from functools import lru_cache

from langchain_core.embeddings import Embeddings

from app.core.config import settings
from app.core.exceptions import ServiceIndisponible


@lru_cache(maxsize=1)
def obtenir_embeddings() -> Embeddings:
    """Retourne l'embedder du fournisseur choisi, créé une seule fois.

    Mis en cache : il garde sa connexion HTTP, le recréer à chaque question
    coûterait une poignée de main TLS par appel.
    """
    if settings.EMBEDDINGS_FOURNISSEUR == "google":
        return _embeddings_google()
    if settings.EMBEDDINGS_FOURNISSEUR == "jina":
        return _embeddings_jina()
    if not settings.HF_API_TOKEN:
        raise ServiceIndisponible(
            "L'assistant n'est pas configuré : HF_API_TOKEN est absent."
        )
    from langchain_huggingface import HuggingFaceEndpointEmbeddings

    return HuggingFaceEndpointEmbeddings(
        model=settings.LC_EMBEDDING_MODEL,
        huggingfacehub_api_token=settings.HF_API_TOKEN,
        task="feature-extraction",
    )


def _embeddings_google() -> Embeddings:
    """Embeddings Gemini (API Gemini Developer, quota gratuit).

    La clé est passée explicitement, jamais lue dans l'environnement du
    processus : une seule source de vérité, `settings`, comme pour Groq.
    """
    if not settings.GOOGLE_API_KEY:
        raise ServiceIndisponible(
            "L'assistant n'est pas configuré : GOOGLE_API_KEY est absente."
        )
    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    return GoogleGenerativeAIEmbeddings(
        model=settings.GOOGLE_EMBEDDING_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        output_dimensionality=settings.GOOGLE_EMBEDDING_DIMENSION,
    )


def _embeddings_jina() -> Embeddings:
    """Embeddings Jina AI (`jina-embeddings-v3`, quota gratuit sans carte)."""
    if not settings.JINA_API_KEY:
        raise ServiceIndisponible(
            "L'assistant n'est pas configuré : JINA_API_KEY est absente."
        )
    from app.ai_langchain.embeddings_jina import JinaEmbeddings

    return JinaEmbeddings(
        cle=settings.JINA_API_KEY,
        modele=settings.JINA_EMBEDDING_MODEL,
        dimension=settings.JINA_EMBEDDING_DIMENSION,
    )
