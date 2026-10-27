"""Repository de l'entité DOMAINE_FORMATION."""

from sqlalchemy import select

from app.models.domaine_formation import DomaineFormation
from app.repositories.base_repository import BaseRepository


class DomaineFormationRepository(BaseRepository[DomaineFormation]):
    """CRUD générique, plus la recherche par libellé."""

    modele = DomaineFormation

    def get_by_libelle(
        self, libelle: str, inclure_supprimes: bool = False
    ) -> DomaineFormation | None:
        """Retourne le domaine **actif** portant ce libellé, ou None.

        Sert le pré-contrôle du doublon. Le filtre sur `supprime_le` n'est pas
        facultatif : `uq_domaine_formation_libelle` est un index *partiel*, donc
        plusieurs lignes peuvent partager un libellé — une active et autant
        d'archivées qu'on veut. Sans lui, `one_or_none()` lèverait
        `MultipleResultsFound` dès la première recréation après archivage.
        """
        requete = select(DomaineFormation).where(DomaineFormation.libelle == libelle)
        if not inclure_supprimes:
            requete = requete.where(DomaineFormation.supprime_le.is_(None))
            return self.db.scalars(requete).one_or_none()
        return self.db.scalars(requete).first()
