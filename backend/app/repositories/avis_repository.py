"""Repository de l'entité AVIS."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.avis import Avis
from app.repositories.base_repository import BaseRepository


class AvisRepository(BaseRepository[Avis]):
    """CRUD générique, plus les recherches par cible."""

    modele = Avis

    def par_ligne(self, id_ligne: int) -> Sequence[Avis]:
        """Avis actifs portant sur une ligne de commande donnée."""
        requete = select(Avis).where(
            Avis.id_ligne == id_ligne, Avis.supprime_le.is_(None)
        )
        return self.db.scalars(requete.order_by(Avis.date_avis.desc())).all()

    def par_reservation(self, id_reservation: int) -> Sequence[Avis]:
        """Avis actifs portant sur une réservation donnée."""
        requete = select(Avis).where(
            Avis.id_reservation == id_reservation, Avis.supprime_le.is_(None)
        )
        return self.db.scalars(requete.order_by(Avis.date_avis.desc())).all()
