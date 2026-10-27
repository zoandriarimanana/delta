"""Indexation : texte d'une entité → fragments → index vectoriel.

Partie générique seulement. Ce qui est propre à chaque entité — quel texte
construire, quels champs exclure — vit dans un fichier par entité (12.3), qui
appelle les fonctions ci-dessous.

**Une panne d'indexation ne fait jamais échouer l'action d'un administrateur.**
Les fonctions `*_sans_echec` sont appelées depuis les services métier, après
une création, une modification ou un archivage : si l'API d'embeddings est
indisponible ou hors quota, le produit est bel et bien enregistré, l'index
prend simplement du retard — et la panne est journalisée. L'inverse ferait
dépendre la gestion du catalogue de la santé d'un service tiers.
"""

from collections.abc import Callable, Sequence

from langchain_core.documents import Document
from langchain_postgres import PGVector
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.ai_langchain.audience import AUDIENCE_CLIENT, AUDIENCE_PERSONNEL  # noqa: F401
from app.ai_langchain.vector_store import (
    obtenir_vector_store,
    supprimer_par_contenu,
)
from app.core.config import settings
from app.core.logging import get_logger

journal = get_logger(__name__)

TAILLE_FRAGMENT = 1000
CHEVAUCHEMENT = 150
# Un fragment plus court n'apporte rien au retriever, sinon du bruit. Seuil
# abaissé à 3 mots, contre 10 dans le module d'origine : une fiche du
# catalogue Delta est souvent courte (« Catégorie : Confitures »), et la
# retirer entièrement de l'index serait pire qu'un fragment maigre.
MOTS_MINIMUM = 3

_decoupeur = RecursiveCharacterTextSplitter(
    chunk_size=TAILLE_FRAGMENT,
    chunk_overlap=CHEVAUCHEMENT,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def decouper(
    texte: str,
    type_contenu: str,
    id_contenu: int,
    titre: str | None = None,
    audience: str = AUDIENCE_CLIENT,
) -> list[Document]:
    """Découpe un texte en fragments portant leur origine en métadonnées.

    `titre` — le nom de la fiche — voyage avec chaque fragment jusqu'aux
    sources de la réponse : le frontend affiche « Tarte au citron » plutôt
    que « produit n°3 », sans relire la base.
    """
    if not texte.strip():
        return []
    metadonnees: dict[str, str | int] = {
        "type_contenu": type_contenu,
        "id_contenu": id_contenu,
        "audience": audience,
    }
    if titre:
        metadonnees["titre"] = titre
    return [
        Document(page_content=fragment, metadata=dict(metadonnees))
        for fragment in _decoupeur.split_text(texte)
        if len(fragment.split()) >= MOTS_MINIMUM
    ]


def indexer_texte(
    type_contenu: str,
    id_contenu: int,
    texte: str | Sequence[str],
    store: PGVector | None = None,
    titre: str | None = None,
    audience: str = AUDIENCE_CLIENT,
) -> int:
    """Remplace les fragments d'une entité par ceux de son texte actuel.

    Supprime puis réinsère, plutôt qu'une mise à jour fragment par fragment :
    le nombre de fragments change quand le texte change, et des fragments
    orphelins répondraient encore pour une version périmée de la fiche.

    **Les vecteurs sont calculés avant toute suppression** (9 octobre 2026) :
    si le fournisseur d'embeddings refuse ou tombe, l'ancien contenu reste en
    place, intact. Seule l'écriture en base reste en deux temps (suppression
    par le moteur de l'application, insertion par le pool de PGVector).
    """
    store = store or obtenir_vector_store()
    fragments = fragments_de(type_contenu, id_contenu, texte, titre, audience)
    vecteurs = vectoriser(store, fragments)
    supprimer_par_contenu(type_contenu, id_contenu, store.collection_name)
    ranger(store, fragments, vecteurs)
    return len(fragments)


def fragments_de(
    type_contenu: str,
    id_contenu: int,
    texte: str | Sequence[str],
    titre: str | None = None,
    audience: str = AUDIENCE_CLIENT,
) -> list[Document]:
    """Fragments d'une entité. Une liste de textes : des sections découpées
    chacune pour soi (guides), pour qu'un fragment ne mêle jamais la fin d'une
    section au début d'une autre."""
    parties = [texte] if isinstance(texte, str) else list(texte)
    return [
        fragment
        for partie in parties
        for fragment in decouper(partie, type_contenu, id_contenu, titre, audience)
    ]


def vectoriser(store: PGVector, fragments: list[Document]) -> list[list[float]]:
    """Vecteurs des fragments — le seul appel au fournisseur. Lève s'il échoue,
    **avant** que quoi que ce soit n'ait été retiré de l'index."""
    if not fragments:
        return []
    return store.embeddings.embed_documents([f.page_content for f in fragments])


def ranger(
    store: PGVector, fragments: list[Document], vecteurs: list[list[float]]
) -> None:
    """Écrit des fragments déjà vectorisés, sans rappeler le fournisseur."""
    if fragments:
        store.add_embeddings(
            texts=[f.page_content for f in fragments],
            embeddings=vecteurs,
            metadatas=[f.metadata for f in fragments],
        )


def indexer_sans_echec(
    type_contenu: str,
    id_contenu: int,
    construire_texte: Callable[[], str],
    titre: str | None = None,
    audience: str = AUDIENCE_CLIENT,
) -> int:
    """Indexe une entité ; journalise et rend 0 en cas d'échec, sans lever.

    `construire_texte` est une fonction et non un texte déjà calculé : la
    construction elle-même reste dans le `try` — une entité mal formée ne doit
    pas plus faire échouer l'action de l'administrateur qu'une panne réseau.
    """
    if not settings.AI_ENABLED:
        return 0
    try:
        return indexer_texte(
            type_contenu, id_contenu, construire_texte(), titre=titre, audience=audience
        )
    except Exception:
        journal.warning(
            "Indexation IA échouée pour %s#%s",
            type_contenu,
            id_contenu,
            exc_info=True,
        )
        return 0


def desindexer_sans_echec(type_contenu: str, id_contenu: int) -> int:
    """Retire une entité de l'index ; journalise et rend 0 en cas d'échec."""
    if not settings.AI_ENABLED:
        return 0
    try:
        return supprimer_par_contenu(type_contenu, id_contenu)
    except Exception:
        journal.warning(
            "Désindexation IA échouée pour %s#%s",
            type_contenu,
            id_contenu,
            exc_info=True,
        )
        return 0
