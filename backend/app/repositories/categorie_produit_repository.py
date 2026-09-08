"""Repository de l'entité CATEGORIE_PRODUIT."""

from sqlalchemy import select

from app.models.categorie_produit import CategorieProduit
from app.repositories.base_repository import BaseRepository


class CategorieProduitRepository(BaseRepository[CategorieProduit]):
    """CRUD générique, plus la recherche par libellé."""

    modele = CategorieProduit

    def get_by_libelle(
        self, libelle: str, inclure_supprimes: bool = False
    ) -> CategorieProduit | None:
        """Retourne la catégorie **active** portant ce libellé, ou None.

        Sert le pré-contrôle du doublon. Le filtre sur `supprime_le` n'est pas
        facultatif : `uq_categorie_produit_libelle` est un index *partiel*, donc
        plusieurs lignes peuvent partager un libellé — une active et autant
        d'archivées qu'on veut. Sans lui, `one_or_none()` lèverait
        `MultipleResultsFound` dès la première recréation après archivage.

        Avec le filtre, `one_or_none()` reste juste : l'index partiel garantit
        au plus une ligne active par libellé.
        """
        requete = select(CategorieProduit).where(CategorieProduit.libelle == libelle)
        if not inclure_supprimes:
            requete = requete.where(CategorieProduit.supprime_le.is_(None))
            return self.db.scalars(requete).one_or_none()
        return self.db.scalars(requete).first()
