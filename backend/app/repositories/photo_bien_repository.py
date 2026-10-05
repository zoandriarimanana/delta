"""Repository de l'entité PHOTO_BIEN."""

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import undefer

from app.models.photo_bien import PhotoBien
from app.repositories.base_repository import BaseRepository


class PhotoBienRepository(BaseRepository[PhotoBien]):
    """CRUD générique, plus la galerie d'un bien et la lecture des octets."""

    modele = PhotoBien

    def lister_par_salle(self, id_salle: int) -> Sequence[PhotoBien]:
        """Photos actives d'une salle, dans l'ordre d'ajout — la première sert
        de couverture."""
        return self._lister(PhotoBien.id_salle == id_salle)

    def lister_par_logement(self, id_logement: int) -> Sequence[PhotoBien]:
        """Photos actives d'un logement, dans l'ordre d'ajout."""
        return self._lister(PhotoBien.id_logement == id_logement)

    def _lister(self, critere: object) -> Sequence[PhotoBien]:
        requete = (
            select(PhotoBien)
            .where(critere, PhotoBien.supprime_le.is_(None))  # type: ignore[arg-type]
            .order_by(PhotoBien.date_ajout, PhotoBien.id_photo)
        )
        return self.db.scalars(requete).all()

    def compter_par_salle(self, id_salle: int) -> int:
        """Nombre de photos actives d'une salle — borne de la galerie."""
        return self._compter(PhotoBien.id_salle == id_salle)

    def compter_par_logement(self, id_logement: int) -> int:
        """Nombre de photos actives d'un logement."""
        return self._compter(PhotoBien.id_logement == id_logement)

    def _compter(self, critere: object) -> int:
        requete = (
            select(func.count())
            .select_from(PhotoBien)
            .where(critere, PhotoBien.supprime_le.is_(None))  # type: ignore[arg-type]
        )
        return self.db.scalar(requete) or 0

    def obtenir_avec_contenu(self, id_photo: int) -> PhotoBien | None:
        """Photo active **octets compris** — seul chemin qui lève le `deferred`."""
        requete = (
            select(PhotoBien)
            .options(undefer(PhotoBien.contenu))
            .where(PhotoBien.id_photo == id_photo, PhotoBien.supprime_le.is_(None))
        )
        return self.db.scalars(requete).first()
