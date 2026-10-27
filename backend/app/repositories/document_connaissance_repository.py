"""Repository de l'entité DOCUMENT_CONNAISSANCE."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.document_connaissance import DocumentConnaissance
from app.repositories.base_repository import BaseRepository


class DocumentConnaissanceRepository(BaseRepository[DocumentConnaissance]):
    """CRUD générique, plus la liste d'administration sans le texte extrait."""

    modele = DocumentConnaissance

    def lister_recents(
        self, inclure_supprimes: bool = False
    ) -> Sequence[DocumentConnaissance]:
        """Documents du plus récent au plus ancien.

        `list()` générique trie par clé primaire ; l'administration regarde
        d'abord ce qui vient d'être ajouté.
        """
        requete = select(DocumentConnaissance).order_by(
            DocumentConnaissance.date_ajout.desc(),
            DocumentConnaissance.id_document.desc(),
        )
        if not inclure_supprimes:
            requete = requete.where(DocumentConnaissance.supprime_le.is_(None))
        return self.db.scalars(requete).all()
