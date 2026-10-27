"""Embeddings Jina AI (`EMBEDDINGS_FOURNISSEUR=jina`), ajouté le 12 octobre 2026.

Google avait refusé l'accès au projet de l'utilisateur (403 « Your project has
been denied access »), Hugging Face n'avait plus de crédits (402). Jina offre
un quota gratuit sans carte bancaire et un modèle **multilingue**
(`jina-embeddings-v3`, 1024 dimensions — la même taille que l'index
`bge-m3` d'origine).

Un client HTTP de quelques lignes plutôt qu'une bibliothèque de plus :
l'API est un seul point d'entrée, et `httpx` est déjà installé. Jina
distingue la vectorisation d'un **passage** indexé de celle d'une
**question** (`task`) : c'est ce qui lui fait rapprocher une question courte
du bon fragment, plus long.
"""

import httpx
from langchain_core.embeddings import Embeddings

URL_JINA = "https://api.jina.ai/v1/embeddings"
# Bien sous la limite de l'API, pour qu'une requête reste courte et qu'un
# échec n'emporte qu'un lot — la réindexation, elle, reste tout-ou-rien.
TAILLE_LOT = 64
DELAI_SECONDES = 30.0


class JinaEmbeddings(Embeddings):
    """Embedder LangChain adossé à l'API Jina."""

    def __init__(
        self,
        cle: str,
        modele: str,
        dimension: int,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        """`transport` ne sert qu'aux tests : la CI n'appelle jamais Jina."""
        self._modele = modele
        self._dimension = dimension
        self._client = httpx.Client(
            headers={"Authorization": f"Bearer {cle}"},
            timeout=DELAI_SECONDES,
            transport=transport,
        )

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Vectorise des passages à indexer, par lots."""
        vecteurs: list[list[float]] = []
        for debut in range(0, len(texts), TAILLE_LOT):
            lot = texts[debut : debut + TAILLE_LOT]
            vecteurs.extend(self._vectoriser(lot, "retrieval.passage"))
        return vecteurs

    def embed_query(self, text: str) -> list[float]:
        """Vectorise une question de visiteur."""
        return self._vectoriser([text], "retrieval.query")[0]

    def _vectoriser(self, textes: list[str], tache: str) -> list[list[float]]:
        """Un appel à l'API. Une erreur HTTP remonte telle quelle : son
        message porte le code (402, 401…), que la réindexation traduit."""
        if not textes:
            return []
        reponse = self._client.post(
            URL_JINA,
            json={
                "model": self._modele,
                "task": tache,
                "dimensions": self._dimension,
                "truncate": True,
                "input": textes,
            },
        )
        reponse.raise_for_status()
        donnees = sorted(reponse.json()["data"], key=lambda ligne: ligne["index"])
        return [ligne["embedding"] for ligne in donnees]
