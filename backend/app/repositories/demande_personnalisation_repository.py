"""Repository de l'entité DEMANDE_PERSONNALISATION."""

from sqlalchemy import select

from app.models.demande_personnalisation import DemandePersonnalisation
from app.repositories.base_repository import BaseRepository


class DemandePersonnalisationRepository(BaseRepository[DemandePersonnalisation]):
    """CRUD générique, plus la recherche par ligne de commande."""

    modele = DemandePersonnalisation

    def get_by_ligne(
        self, id_ligne: int, inclure_supprimes: bool = False
    ) -> DemandePersonnalisation | None:
        """Retourne la demande **active** portant sur cette ligne, ou None.

        `UNIQUE (id_ligne)` est **globale** et non partielle : c'est une
        cardinalité (1,1), pas une identité métier. Une ligne archivée ne libère
        donc pas sa place, et `one_or_none()` ne peut pas rencontrer de doublon
        — contrairement aux recherches par e-mail, où l'index partiel impose le
        filtre pour éviter `MultipleResultsFound`.

        Le filtre sur `supprime_le` reste utile pour ne pas remonter une demande
        archivée sous une ligne encore active.
        """
        requete = select(DemandePersonnalisation).where(
            DemandePersonnalisation.id_ligne == id_ligne
        )
        if not inclure_supprimes:
            requete = requete.where(DemandePersonnalisation.supprime_le.is_(None))
        return self.db.scalars(requete).one_or_none()
