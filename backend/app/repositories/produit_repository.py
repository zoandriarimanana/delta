"""Repository de l'entité PRODUIT."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.produit import Produit
from app.repositories.base_repository import BaseRepository


class ProduitRepository(BaseRepository[Produit]):
    """CRUD générique, plus la recherche par catégorie."""

    modele = Produit

    def rechercher_par_categorie(
        self, id_categorie: int, skip: int = 0, limit: int | None = None
    ) -> Sequence[Produit]:
        """Retourne les produits d'une catégorie donnée.

        Une catégorie inexistante donne une liste vide, pas une erreur : le
        filtre est un critère de recherche, pas la désignation d'une ressource.
        """
        requete = (
            select(Produit).where(Produit.id_categorie == id_categorie).offset(skip)
        )
        if limit is not None:
            requete = requete.limit(limit)
        return self.db.scalars(requete).all()
