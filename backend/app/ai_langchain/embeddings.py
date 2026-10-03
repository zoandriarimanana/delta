"""Embeddings de l'assistant : API d'inférence Hugging Face.

Un seul fournisseur, distant, et jamais un modèle local : la cible de
déploiement (Render) doit rester légère, sans `torch`. Modèle multilingue,
le contenu étant en français et parfois en malgache.
"""

from functools import lru_cache

from langchain_core.embeddings import Embeddings

from app.core.config import settings
from app.core.exceptions import ServiceIndisponible


@lru_cache(maxsize=1)
def obtenir_embeddings() -> Embeddings:
    """Retourne l'embedder Hugging Face, créé une seule fois.

    Mis en cache : il garde sa connexion HTTP, le recréer à chaque question
    coûterait une poignée de main TLS par appel.
    """
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
