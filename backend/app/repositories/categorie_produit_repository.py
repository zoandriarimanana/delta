"""Repository de l'entité CATEGORIE_PRODUIT."""

from sqlalchemy import select

from app.models.categorie_produit import CategorieProduit
from app.repositories.base_repository import BaseRepository


class CategorieProduitRepository(BaseRepository[CategorieProduit]):
    """CRUD générique, plus la recherche par libellé."""

    modele = CategorieProduit

    def get_by_libelle(self, libelle: str) -> CategorieProduit | None:
        """Retourne la catégorie portant ce libellé, ou None.

        Sert le pré-contrôle du doublon. Ne peut pas remonter plus d'une ligne :
        `uq_categorie_produit_libelle` le garantit en base.
        """
        return self.db.scalars(
            select(CategorieProduit).where(CategorieProduit.libelle == libelle)
        ).one_or_none()
