"""Service métier de DOCUMENT_CONNAISSANCE (Sprint 12, 12.9).

Téléverser = contrôler, extraire, enregistrer, **puis** indexer. L'indexation
vient après le `commit`, comme pour le catalogue ; si elle échoue (fournisseur
d'embeddings en panne), le document reste enregistré — son texte suffit à le
réindexer plus tard — et la réponse le signale par `nombre_fragments = 0`.
"""

from collections.abc import Sequence
from typing import Any

from sqlalchemy.orm import Session

from app.ai_langchain.extraction import extraire
from app.ai_langchain.textes.document_connaissance import (
    TYPE_CONTENU,
    synchroniser_document_connaissance,
)
from app.core.config import settings
from app.core.exceptions import ErreurMetier, RessourceIntrouvable, ServiceIndisponible
from app.models.document_connaissance import DocumentConnaissance, PublicCible
from app.models.personnel import Personnel
from app.repositories.document_connaissance_repository import (
    DocumentConnaissanceRepository,
)
from app.schemas.document_connaissance import LONGUEUR_APERCU

LONGUEUR_MAX_TITRE = 200


class DocumentConnaissanceService:
    """Base de connaissances de l'assistant, côté administration."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.documents = DocumentConnaissanceRepository(db)

    def _exiger_assistant_actif(self) -> None:
        """Le téléversement n'a de sens qu'assistant actif : il sert l'index,
        et ses bibliothèques d'extraction vivent dans `requirements-ai.txt`."""
        if not settings.AI_ENABLED:
            raise ServiceIndisponible(
                "L'assistant IA est désactivé : la base de connaissances "
                "n'accepte pas de document pour le moment."
            )

    def _fragments_par_document(self) -> dict[int, int] | None:
        if not settings.AI_ENABLED:
            return None
        from app.ai_langchain.vector_store import compter_par_contenu

        return compter_par_contenu(TYPE_CONTENU)

    def _lecture(
        self, document: DocumentConnaissance, fragments: dict[int, int] | None
    ) -> dict[str, Any]:
        return {
            "id_document": document.id_document,
            "titre": document.titre,
            "nom_fichier": document.nom_fichier,
            "type_fichier": document.type_fichier,
            "taille_octets": document.taille_octets,
            "public_cible": document.public_cible,
            "date_ajout": document.date_ajout,
            "id_personnel": document.id_personnel,
            "supprime_le": document.supprime_le,
            "apercu": document.texte_extrait[:LONGUEUR_APERCU],
            "nombre_fragments": (
                None if fragments is None else fragments.get(document.id_document, 0)
            ),
        }

    def televerser(
        self,
        contenu: bytes,
        nom_fichier: str,
        titre: str,
        public_cible: PublicCible,
        auteur: Personnel,
    ) -> dict[str, Any]:
        """Contrôle, extrait, enregistre puis indexe un document.

        400 si le fichier est refusé (format, taille, texte absent). L'auteur
        vient du jeton, jamais du corps — même règle que
        `COMMANDE.#id_personnel`.
        """
        self._exiger_assistant_actif()
        titre = titre.strip()
        if not titre or len(titre) > LONGUEUR_MAX_TITRE:
            raise ErreurMetier(
                f"Le titre est obligatoire ({LONGUEUR_MAX_TITRE} caractères au plus)."
            )
        type_fichier, texte = extraire(contenu, nom_fichier)
        document = self.documents.create(
            {
                "titre": titre,
                # Nom d'origine tronqué : affiché, jamais utilisé comme chemin.
                "nom_fichier": (nom_fichier or "document")[:255],
                "type_fichier": type_fichier,
                "taille_octets": len(contenu),
                "public_cible": public_cible,
                "texte_extrait": texte,
                "id_personnel": auteur.id_personnel,
            }
        )
        self.db.commit()
        self.db.refresh(document)
        synchroniser_document_connaissance(document)
        return self._lecture(document, self._fragments_par_document())

    def lister(self, inclure_archives: bool = False) -> list[dict[str, Any]]:
        fragments = self._fragments_par_document()
        documents: Sequence[DocumentConnaissance] = self.documents.lister_recents(
            inclure_supprimes=inclure_archives
        )
        return [self._lecture(document, fragments) for document in documents]

    def supprimer(self, id_document: int) -> None:
        """Archive le document et le retire de l'index."""
        document = self.documents.get_by_id(id_document)
        if document is None:
            raise RessourceIntrouvable("Document introuvable.")
        self.documents.delete(document)
        self.db.commit()
        synchroniser_document_connaissance(document)

    def restaurer(self, id_document: int) -> dict[str, Any]:
        """Réactive un document archivé et le réindexe. Idempotent."""
        document = self.documents.get_by_id(id_document, inclure_supprimes=True)
        if document is None:
            raise RessourceIntrouvable("Document introuvable.")
        if document.supprime_le is not None:
            self.documents.restaurer(document)
            self.db.commit()
            synchroniser_document_connaissance(document)
        return self._lecture(document, self._fragments_par_document())
