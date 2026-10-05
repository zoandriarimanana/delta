"""Réindexation complète du catalogue public.

Appelée par le script `scripts/reindexer_assistant.py` (premier déploiement,
changement de modèle d'embeddings) et par l'administration (12.4). La
synchronisation au fil de l'eau, elle, passe par `synchronisation.py`.

**Contrairement à la synchronisation, elle lève** en cas de panne : c'est une
action explicite, son auteur doit savoir qu'elle a échoué — l'index serait
sinon incomplet sans que personne le sache.
"""

from collections.abc import Callable, Iterable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai_langchain import guides
from app.ai_langchain.indexation import indexer_texte
from app.ai_langchain.textes import (
    categorie_produit,
    domaine_formation,
    formation,
    logement,
    produit,
    salle,
)
from app.ai_langchain.vector_store import obtenir_vector_store, supprimer_par_contenu
from app.core.config import settings
from app.core.exceptions import ServiceIndisponible
from app.models.categorie_produit import CategorieProduit
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.logement import Logement
from app.models.produit import Produit
from app.models.salle import Salle

# (module de texte, modèle, nom de la clé primaire)
CONTENUS = (
    (produit, Produit, "id_produit"),
    (categorie_produit, CategorieProduit, "id_categorie"),
    (formation, Formation, "id_formation"),
    (domaine_formation, DomaineFormation, "id_domaine"),
    (salle, Salle, "id_salle"),
    (logement, Logement, "id_logement"),
)


def _indexer_type(
    type_contenu: str,
    entites: Iterable[Any],
    cle: str,
    est_indexable: Callable[[Any], bool],
    construire_texte: Callable[[Any], str],
    titre: Callable[[Any], str],
) -> dict[str, int]:
    """Vide un type de contenu, puis réindexe ses entités indexables.

    Vider d'abord : une entité supprimée depuis la dernière indexation n'a plus
    de ligne à parcourir, ses fragments ne partiraient jamais autrement.
    """
    store = obtenir_vector_store()
    supprimer_par_contenu(type_contenu, collection=store.collection_name)
    elements = fragments = 0
    for entite in entites:
        if est_indexable(entite):
            fragments += indexer_texte(
                type_contenu,
                getattr(entite, cle),
                construire_texte(entite),
                store,
                titre=titre(entite),
            )
            elements += 1
    return {"elements": elements, "fragments": fragments}


def _indexer_guides() -> dict[str, int]:
    """Vide puis réindexe les guides versionnés, section par section."""
    store = obtenir_vector_store()
    supprimer_par_contenu(guides.TYPE_CONTENU, collection=store.collection_name)
    elements = fragments = 0
    for guide in guides.guides_presents():
        fragments += indexer_texte(
            guides.TYPE_CONTENU,
            guide.identifiant,
            guides.sections(guide.chemin.read_text(encoding="utf-8")),
            store,
            titre=guide.titre,
            audience=guide.audience,
        )
        elements += 1
    return {"elements": elements, "fragments": fragments}


def reindexer_tout(db: Session) -> dict[str, dict[str, int]]:
    """Reconstruit l'index entier depuis la base. Lève si l'assistant est coupé."""
    if not settings.AI_ENABLED:
        raise ServiceIndisponible("L'assistant IA est désactivé (AI_ENABLED=false).")
    resultats = {
        module.TYPE_CONTENU: _indexer_type(
            module.TYPE_CONTENU,
            # `supprime_le` filtré en SQL : inutile de charger les archives.
            db.scalars(select(modele).where(modele.supprime_le.is_(None))).all(),
            cle,
            module.est_indexable,
            module.construire_texte,
            module.titre,
        )
        for module, modele, cle in CONTENUS
    }
    resultats[guides.TYPE_CONTENU] = _indexer_guides()
    return resultats
