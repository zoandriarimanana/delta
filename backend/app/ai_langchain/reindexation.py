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
from app.ai_langchain.audience import AUDIENCE_CLIENT
from app.ai_langchain.indexation import fragments_de, ranger, vectoriser
from app.ai_langchain.textes import (
    categorie_produit,
    document_connaissance,
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
from app.models.document_connaissance import DocumentConnaissance
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
    (document_connaissance, DocumentConnaissance, "id_document"),
)


def _indexer_type(
    type_contenu: str,
    entites: Iterable[Any],
    cle: str,
    est_indexable: Callable[[Any], bool],
    construire_texte: Callable[[Any], str],
    titre: Callable[[Any], str],
    audience: Callable[[Any], str],
) -> dict[str, int]:
    """Remplace tout un type de contenu par ses entités indexables.

    **Tout vectoriser d'abord, ne remplacer qu'ensuite** (9 octobre 2026) :
    vider puis réindexer entité par entité laissait, sur une panne du
    fournisseur en cours de route, un type à moitié vide — voire des
    vecteurs de deux modèles mêlés. Désormais un échec ne touche à rien.

    Vider le type, et non entité par entité : une entité supprimée depuis la
    dernière indexation n'a plus de ligne à parcourir, ses fragments ne
    partiraient jamais autrement.
    """
    store = obtenir_vector_store()
    fragments = []
    elements = 0
    for entite in entites:
        if est_indexable(entite):
            fragments += fragments_de(
                type_contenu,
                getattr(entite, cle),
                construire_texte(entite),
                titre=titre(entite),
                audience=audience(entite),
            )
            elements += 1
    vecteurs = vectoriser(store, fragments)
    supprimer_par_contenu(type_contenu, collection=store.collection_name)
    ranger(store, fragments, vecteurs)
    return {"elements": elements, "fragments": len(fragments)}


def _indexer_guides() -> dict[str, int]:
    """Remplace les guides versionnés, section par section — même règle :
    tout vectoriser avant de retirer quoi que ce soit."""
    store = obtenir_vector_store()
    fragments = []
    elements = 0
    for guide in guides.guides_presents():
        fragments += fragments_de(
            guides.TYPE_CONTENU,
            guide.identifiant,
            guides.sections(guide.chemin.read_text(encoding="utf-8")),
            titre=guide.titre,
            audience=guide.audience,
        )
        elements += 1
    vecteurs = vectoriser(store, fragments)
    supprimer_par_contenu(guides.TYPE_CONTENU, collection=store.collection_name)
    ranger(store, fragments, vecteurs)
    return {"elements": elements, "fragments": len(fragments)}


def _verifier_fournisseur() -> None:
    """Sonde le service d'embeddings avant tout travail.

    Un fournisseur sans crédits (402 de Hugging Face, 9 octobre 2026) ou qui
    refuse l'accès (403 de Google, 12 octobre) est ainsi signalé tout de
    suite, par un message clair. La sonde ne suffit pas à elle seule — un
    fournisseur peut couper l'accès en cours de route, constaté chez Google :
    c'est pourquoi chaque type est aussi entièrement vectorisé **avant**
    d'être remplacé (`_indexer_type`).
    """
    try:
        # `embed_documents` et non `embed_query` : c'est l'appel que fait
        # l'indexation, et un fournisseur peut accepter l'un et refuser l'autre.
        obtenir_vector_store().embeddings.embed_documents(["Delta"])
    except Exception as erreur:  # noqa: BLE001 — tout échec du fournisseur
        raise _indisponible(erreur) from erreur


def _indisponible(erreur: Exception) -> ServiceIndisponible:
    """Traduit une panne du fournisseur d'embeddings en message lisible."""
    detail = str(erreur)
    if "402" in detail:
        raison = "le compte du fournisseur d'embeddings n'a plus de crédits (402)"
    elif "403" in detail or "401" in detail:
        code = "403" if "403" in detail else "401"
        raison = (
            "le fournisseur d'embeddings refuse l'accès "
            f"(clé ou projet bloqué, {code})"
        )
    else:
        raison = f"le fournisseur d'embeddings ne répond pas ({type(erreur).__name__})"
    return ServiceIndisponible(
        f"{raison[0].upper()}{raison[1:]}. L'index actuel n'a pas été modifié."
    )


def reindexer_tout(db: Session) -> dict[str, dict[str, int]]:
    """Reconstruit l'index entier depuis la base. Lève si l'assistant est coupé
    ou si le fournisseur d'embeddings ne répond pas — dans ce cas, **avant**
    d'avoir touché à l'index."""
    if not settings.AI_ENABLED:
        raise ServiceIndisponible("L'assistant IA est désactivé (AI_ENABLED=false).")
    _verifier_fournisseur()
    try:
        return _reindexer(db)
    except ServiceIndisponible:
        raise
    except Exception as erreur:  # noqa: BLE001 — panne du fournisseur en cours de route
        raise _indisponible(erreur) from erreur


def _reindexer(db: Session) -> dict[str, dict[str, int]]:
    resultats = {
        module.TYPE_CONTENU: _indexer_type(
            module.TYPE_CONTENU,
            # `supprime_le` filtré en SQL : inutile de charger les archives.
            db.scalars(select(modele).where(modele.supprime_le.is_(None))).all(),
            cle,
            module.est_indexable,
            module.construire_texte,
            module.titre,
            # Le catalogue est entièrement `client` ; seuls les documents
            # téléversés choisissent leur public.
            getattr(module, "audience", lambda _entite: AUDIENCE_CLIENT),
        )
        for module, modele, cle in CONTENUS
    }
    resultats[guides.TYPE_CONTENU] = _indexer_guides()
    return resultats
