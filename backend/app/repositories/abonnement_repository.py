"""Repository de l'entité ABONNEMENT."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.abonnement import Abonnement
from app.repositories.base_repository import BaseRepository


class AbonnementRepository(BaseRepository[Abonnement]):
    """CRUD générique, plus la recherche par client entreprise.

    C'est cette méthode qui porte la restriction « un client entreprise ne
    voit que ses propres abonnements » — le service l'appelle plutôt que
    `list()`, réservé à l'administrateur.
    """

    modele = Abonnement

    def par_client_entreprise(
        self,
        id_client_entreprise: int,
        inclure_supprimes: bool = False,
    ) -> Sequence[Abonnement]:
        """Abonnements d'une entreprise cliente, les plus récents d'abord."""
        requete = select(Abonnement).where(
            Abonnement.id_client_entreprise == id_client_entreprise
        )
        if not inclure_supprimes:
            requete = requete.where(Abonnement.supprime_le.is_(None))
        requete = requete.order_by(Abonnement.date_debut.desc())
        return self.db.scalars(requete).all()
