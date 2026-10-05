"""Guides de la plateforme, versionnés avec le code (Sprint 12, 12.8/12.10).

Un guide n'est pas une entité du MLD : c'est de la documentation, rédigée à
partir de l'interface réelle et relue comme du code. Il entre dans l'index à
chaque réindexation complète — **modifier un guide impose donc une
réindexation** (`scripts/reindexer_assistant.py`, ou le bouton de
l'administration).

Chaque section `## ...` est indexée **pour elle-même** : un fragment ne mêle
jamais la fin d'une procédure au début d'une autre, ce qui ferait répondre
l'assistant avec les étapes de la mauvaise.
"""

from dataclasses import dataclass
from pathlib import Path

from app.ai_langchain.indexation import AUDIENCE_CLIENT, AUDIENCE_PERSONNEL

DOSSIER = Path(__file__).parent / "guides"
TYPE_CONTENU = "guide"


@dataclass(frozen=True)
class Guide:
    identifiant: int
    fichier: str
    titre: str
    audience: str

    @property
    def chemin(self) -> Path:
        return DOSSIER / self.fichier


GUIDES = (
    Guide(1, "guide_client.md", "Guide de la plateforme", AUDIENCE_CLIENT),
    Guide(2, "guide_personnel.md", "Guide du back-office", AUDIENCE_PERSONNEL),
)


def sections(texte: str) -> list[str]:
    """Découpe un guide Markdown en sections `## ...`, titre compris.

    Le titre de premier niveau (`# ...`) est retiré : il est porté par la
    métadonnée `titre`, et répété dans chaque fragment il n'apporterait que
    du bruit au retriever.
    """
    blocs = []
    for bloc in ("\n" + texte).split("\n## ")[1:]:
        bloc = bloc.strip()
        if bloc:
            blocs.append(f"## {bloc}")
    return blocs


def guides_presents() -> list[Guide]:
    """Les guides dont le fichier existe — un guide absent n'est pas une erreur."""
    return [guide for guide in GUIDES if guide.chemin.is_file()]
