"""Repository de l'entité TAUX_CHANGE."""

from sqlalchemy import select

from app.models.taux_change import Devise, TauxChange
from app.repositories.base_repository import BaseRepository


class TauxChangeRepository(BaseRepository[TauxChange]):
    """Ajoute la seule lecture qui dépasse le CRUD : par code de devise."""

    modele = TauxChange

    def par_devise(self, devise: Devise) -> TauxChange | None:
        """Le taux actif de `devise`, ou `None` s'il n'existe pas."""
        return self.db.scalars(
            select(TauxChange).where(
                TauxChange.devise == devise, TauxChange.supprime_le.is_(None)
            )
        ).first()
