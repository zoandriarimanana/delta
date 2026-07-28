"""Repository de l'entité LIGNE_COMMANDE."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.ligne_commande import LigneCommande
from app.repositories.base_repository import BaseRepository


class LigneCommandeRepository(BaseRepository[LigneCommande]):
    """CRUD générique, plus la recherche par commande.

    Pas de router associé : une ligne ne se manipule jamais hors de sa commande.
    """

    modele = LigneCommande

    def lister_par_commande(
        self, id_commande: int, inclure_supprimes: bool = False
    ) -> Sequence[LigneCommande]:
        """Retourne les lignes **actives** d'une commande.

        Sert la propagation de l'archivage : archiver une commande archive ses
        lignes, et le `ON DELETE CASCADE` du schéma ne s'en charge pas puisqu'un
        archivage est un `UPDATE`.
        """
        requete = select(LigneCommande).where(LigneCommande.id_commande == id_commande)
        if not inclure_supprimes:
            requete = requete.where(LigneCommande.supprime_le.is_(None))
        return self.db.scalars(requete.order_by(LigneCommande.id_ligne)).all()
