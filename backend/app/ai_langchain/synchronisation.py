"""Point d'entrée des services métier vers l'index de l'assistant.

Les services du catalogue appellent `synchroniser()` **après** leur `commit` :
avant, un commit raté laisserait dans l'index une fiche qui n'existe pas.

Ce module n'importe **rien de LangChain** au chargement : les services
l'importent en permanence, y compris dans un déploiement où l'assistant est
désactivé et `requirements-ai.txt` absent. L'indexation n'est importée qu'une
fois `AI_ENABLED` vérifié.
"""

from collections.abc import Callable

from sqlalchemy.orm import object_session

from app.ai_langchain.audience import AUDIENCE_CLIENT
from app.core.config import settings


def assistant_actif() -> bool:
    """Vrai si l'assistant est activé.

    Les `synchroniser_<entite>()` et les services le consultent **avant** de
    toucher à l'entité : charger une catégorie ou les sessions d'une formation
    pour rien ajouterait une requête à chaque écriture du catalogue, assistant
    coupé compris.
    """
    return settings.AI_ENABLED


def recharger_relation(entite: object, relation: str) -> None:
    """Force le rechargement d'une collection avant d'en construire le texte.

    Indispensable, pas défensif : `SessionLocal` est configurée avec
    `expire_on_commit=False` (voir `core/database.py`). Une collection déjà
    chargée — les sessions d'une formation, lues à sa création — n'est donc
    jamais rafraîchie par le `commit`, et une session ajoutée ensuite par sa
    clé étrangère n'y apparaît pas. Bogue constaté en parcours réel (12.3) :
    la formation affichait « aucune session à venir » juste après la création
    d'une session. `expire` n'émet aucune requête ; le rechargement a lieu au
    premier accès, à l'intérieur de la construction du texte.
    """
    session = object_session(entite)
    if session is not None:
        session.expire(entite, [relation])


def synchroniser(
    type_contenu: str,
    id_contenu: int,
    indexable: bool,
    construire_texte: Callable[[], str],
    titre: str | None = None,
    audience: str = AUDIENCE_CLIENT,
) -> None:
    """Indexe l'entité si elle doit l'être, la retire de l'index sinon.

    Une seule fonction pour les deux sens : création, modification, archivage
    et restauration se ramènent tous à « l'état actuel de l'entité doit-il
    figurer dans l'index ? ». Ne lève jamais (voir `indexation`).
    """
    if not assistant_actif():
        return
    from app.ai_langchain.indexation import (
        desindexer_sans_echec,
        indexer_sans_echec,
    )

    if indexable:
        indexer_sans_echec(type_contenu, id_contenu, construire_texte, titre, audience)
    else:
        desindexer_sans_echec(type_contenu, id_contenu)
