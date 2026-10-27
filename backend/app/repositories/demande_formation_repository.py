"""Repository de l'entité DEMANDE_FORMATION."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.demande_formation import DemandeFormation
from app.repositories.base_repository import BaseRepository


class DemandeFormationRepository(BaseRepository[DemandeFormation]):
    """CRUD générique, plus la liste des plus récentes d'abord."""

    modele = DemandeFormation

    def lister_recentes(self) -> Sequence[DemandeFormation]:
        """Demandes actives, les plus récentes d'abord — l'administration
        traite d'abord ce qui vient d'arriver."""
        requete = (
            select(DemandeFormation)
            .where(DemandeFormation.supprime_le.is_(None))
            .order_by(
                DemandeFormation.date_demande.desc(),
                DemandeFormation.id_demande.desc(),
            )
        )
        return self.db.scalars(requete).all()
