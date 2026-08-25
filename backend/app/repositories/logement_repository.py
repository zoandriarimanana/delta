"""Repository de l'entité LOGEMENT."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.logement import Logement, StatutLogement
from app.repositories.base_repository import BaseRepository


class LogementRepository(BaseRepository[Logement]):
    """CRUD générique, plus les recherches par statut et par capacité."""

    modele = Logement

    def rechercher(
        self,
        statut: StatutLogement | None = None,
        capacite_minimale: int | None = None,
        skip: int = 0,
        limit: int | None = None,
        inclure_supprimes: bool = False,
    ) -> Sequence[Logement]:
        """Retourne les logements **actifs** correspondant aux critères.

        Les deux filtres sont des critères de recherche : une combinaison
        qu'aucun logement ne satisfait donne une liste vide, pas une erreur.

        **Ce filtre ne dit rien de la disponibilité à une date donnée.** Il
        retient les logements dont l'*état* le permet ; savoir si l'un d'eux est
        déjà réservé sur une période relève des `RESERVATION`, pas d'ici — voir
        `docs/mld.md`.

        Le filtre sur `supprime_le` n'est pas hérité : cette requête est écrite
        ici et ne passe pas par `list()`. Le tri sur la clé primaire rend la
        pagination déterministe, comme dans `BaseRepository.list`.
        """
        requete = select(Logement)
        if statut is not None:
            requete = requete.where(Logement.statut == statut)
        if capacite_minimale is not None:
            requete = requete.where(Logement.capacite >= capacite_minimale)
        if not inclure_supprimes:
            requete = requete.where(Logement.supprime_le.is_(None))
        requete = requete.order_by(Logement.id_logement).offset(skip)
        if limit is not None:
            requete = requete.limit(limit)
        return self.db.scalars(requete).all()
