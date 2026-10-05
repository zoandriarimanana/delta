"""Texte indexable d'un DOCUMENT_CONNAISSANCE (Sprint 12, 12.9).

Le seul contenu indexé dont l'**audience** varie : un document destiné au
personnel ne doit jamais ressortir dans la bulle publique du site. C'est la
métadonnée `audience` — et le filtre de l'assistant client — qui le
garantissent, pas le prompt.
"""

from app.ai_langchain.audience import AUDIENCE_CLIENT, AUDIENCE_PERSONNEL
from app.ai_langchain.synchronisation import assistant_actif, synchroniser
from app.models.document_connaissance import DocumentConnaissance, PublicCible

TYPE_CONTENU = "document"


def construire_texte(document: DocumentConnaissance) -> str:
    return f"{document.titre}\n\n{document.texte_extrait}"


def titre(document: DocumentConnaissance) -> str:
    """Nom affiché dans les sources d'une réponse."""
    return document.titre


def audience(document: DocumentConnaissance) -> str:
    return (
        AUDIENCE_PERSONNEL
        if document.public_cible == PublicCible.PERSONNEL
        else AUDIENCE_CLIENT
    )


def est_indexable(document: DocumentConnaissance) -> bool:
    return document.supprime_le is None


def synchroniser_document_connaissance(document: DocumentConnaissance) -> None:
    if not assistant_actif():
        return
    synchroniser(
        TYPE_CONTENU,
        document.id_document,
        est_indexable(document),
        lambda: construire_texte(document),
        titre(document),
        audience(document),
    )
