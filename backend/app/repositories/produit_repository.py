"""Repository de l'entité PRODUIT."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.produit import Produit
from app.repositories.base_repository import BaseRepository


class ProduitRepository(BaseRepository[Produit]):
    """CRUD générique, plus la recherche par catégorie."""

    modele = Produit

    def rechercher_par_categorie(
        self,
        id_categorie: int,
        skip: int = 0,
        limit: int | None = None,
        inclure_supprimes: bool = False,
    ) -> Sequence[Produit]:
        """Retourne les produits **actifs** d'une catégorie donnée.

        Une catégorie inexistante donne une liste vide, pas une erreur : le
        filtre est un critère de recherche, pas la désignation d'une ressource.

        Le filtre sur `supprime_le` est indispensable et n'est pas hérité :
        cette requête est écrite ici, elle ne passe pas par `list()`. Sans lui,
        deux incohérences apparaissaient — le catalogue filtré par catégorie
        affichait des produits archivés que le catalogue complet masquait, et le
        pré-contrôle de suppression d'une catégorie comptait ses produits
        archivés, refusant à tort de la supprimer.

        Le tri sur la clé primaire rend la pagination déterministe, comme dans
        `BaseRepository.list`.
        """
        requete = select(Produit).where(Produit.id_categorie == id_categorie)
        if not inclure_supprimes:
            requete = requete.where(Produit.supprime_le.is_(None))
        requete = requete.order_by(Produit.id_produit).offset(skip)
        if limit is not None:
            requete = requete.limit(limit)
        return self.db.scalars(requete).all()
