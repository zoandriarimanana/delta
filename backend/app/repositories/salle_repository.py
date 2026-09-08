"""Repository de l'entité SALLE."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.salle import Salle
from app.repositories.base_repository import BaseRepository


class SalleRepository(BaseRepository[Salle]):
    """CRUD générique, plus la recherche par capacité."""

    modele = Salle

    def rechercher_par_capacite(
        self,
        minimum: int,
        skip: int = 0,
        limit: int | None = None,
        inclure_supprimes: bool = False,
    ) -> Sequence[Salle]:
        """Retourne les salles **actives** pouvant accueillir `minimum` personnes.

        C'est le filtre du catalogue : on cherche une salle par ce qu'elle peut
        contenir, pas par son nom. Une capacité qu'aucune salle n'atteint donne
        une liste vide, pas une erreur — c'est un critère de recherche.

        Le filtre sur `supprime_le` n'est pas hérité : cette requête est écrite
        ici et ne passe pas par `list()`. Sans lui, une salle archivée
        apparaîtrait dans le catalogue filtré alors que le catalogue complet la
        masque.

        Le tri sur la clé primaire rend la pagination déterministe, comme dans
        `BaseRepository.list`.
        """
        requete = select(Salle).where(Salle.capacite >= minimum)
        if not inclure_supprimes:
            requete = requete.where(Salle.supprime_le.is_(None))
        requete = requete.order_by(Salle.id_salle).offset(skip)
        if limit is not None:
            requete = requete.limit(limit)
        return self.db.scalars(requete).all()
