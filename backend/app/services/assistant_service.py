"""Service de l'assistant IA (Sprint 12).

Façade entre le routeur et le module `app.ai_langchain`. **Aucun import de
LangChain au chargement** : `main.py` importe ce service en permanence, y
compris sur un déploiement où l'assistant est coupé et `requirements-ai.txt`
absent. Chaque méthode vérifie l'activation avant d'importer quoi que ce soit.
"""

from collections.abc import Iterator
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ServiceIndisponible

MESSAGE_DESACTIVE = "L'assistant n'est pas disponible pour le moment."

#: Qui pose la question. Une chaîne et non l'objet `Profil` de la chaîne RAG :
#: ce service est importé au démarrage, sans LangChain.
NomProfil = Literal["client", "personnel"]


class AssistantService:
    """Questions des visiteurs, état et réindexation pour l'administration."""

    def __init__(self, db: Session | None = None) -> None:
        self.db = db

    @staticmethod
    def est_actif() -> bool:
        return settings.AI_ENABLED

    def _exiger_actif(self) -> None:
        """Lève 503 si l'assistant est coupé.

        503 et non 404 : la route existe, le service est momentanément
        indisponible — et le frontend masque de toute façon la bulle.
        """
        if not self.est_actif():
            raise ServiceIndisponible(MESSAGE_DESACTIVE)

    def repondre(self, question: str) -> dict[str, Any]:
        """Réponse complète à une question. 503 si coupé ou fournisseur en panne."""
        self._exiger_actif()
        from app.ai_langchain.chaine import repondre

        return repondre(question)

    def repondre_en_flux(
        self, question: str, profil: NomProfil = "client"
    ) -> Iterator[dict[str, Any]]:
        """Réponse en flux : jetons, puis événement de fin avec les sources.

        Le profil `personnel` lit aussi les documents internes et le guide du
        back-office ; **c'est le routeur qui décide du profil**, d'après
        l'authentification — jamais un paramètre de la requête.
        """
        self._exiger_actif()
        from app.ai_langchain.chaine import (
            PROFIL_CLIENT,
            PROFIL_PERSONNEL,
            repondre_en_flux,
        )

        return repondre_en_flux(
            question,
            profil=PROFIL_PERSONNEL if profil == "personnel" else PROFIL_CLIENT,
        )

    def etat(self) -> dict[str, Any]:
        """État de l'assistant, pour l'administration.

        Répond même assistant coupé : c'est précisément ce qu'un
        administrateur doit pouvoir constater. L'index n'est alors pas lu
        (`requirements-ai.txt` peut être absent).
        """
        fragments: dict[str, int] = {}
        llm_joignable = False
        if self.est_actif():
            from app.ai_langchain.llm import est_disponible
            from app.ai_langchain.vector_store import statistiques

            fragments = statistiques()
            llm_joignable = est_disponible()
        return {
            "actif": self.est_actif(),
            "llm_joignable": llm_joignable,
            "modele_llm": settings.GROQ_MODEL,
            "modele_embeddings": settings.modele_embeddings,
            "fragments_par_type": fragments,
            "total_fragments": sum(fragments.values()),
        }

    def reindexer(self) -> dict[str, Any]:
        """Reconstruit tout l'index. Lève en cas de panne, contrairement à la
        synchronisation au fil de l'eau : l'administrateur doit le savoir."""
        self._exiger_actif()
        if self.db is None:
            raise RuntimeError("La réindexation exige une session de base.")
        from app.ai_langchain.reindexation import reindexer_tout

        try:
            par_type = reindexer_tout(self.db)
        except ServiceIndisponible:
            raise
        except Exception as erreur:
            raise ServiceIndisponible(
                "La réindexation a échoué : un fournisseur ne répond pas. "
                "L'index peut être incomplet, relancez-la plus tard."
            ) from erreur
        return {
            "par_type": par_type,
            "total_fragments": sum(c["fragments"] for c in par_type.values()),
        }
