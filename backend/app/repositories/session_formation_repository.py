"""Repository de l'entité SESSION_FORMATION."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.session_formation import SessionFormation, StatutSessionFormation
from app.repositories.base_repository import BaseRepository


class SessionFormationRepository(BaseRepository[SessionFormation]):
    """CRUD générique, plus les recherches par formation et par statut."""

    modele = SessionFormation

    def lister_par_formation(
        self,
        id_formation: int,
        skip: int = 0,
        limit: int | None = None,
        inclure_supprimes: bool = False,
    ) -> Sequence[SessionFormation]:
        """Retourne les sessions **actives** d'une formation donnée.

        Sert deux usages : afficher les dates disponibles sur une fiche, et
        compter avant d'archiver la formation.

        Le filtre sur `supprime_le` n'est pas hérité — cette requête est écrite
        ici et ne passe pas par `list()`. Sans lui, une formation dont toutes
        les sessions sont archivées deviendrait inarchivable, exactement comme
        un domaine dont toutes les formations le sont.

        Le tri sur la clé primaire rend la pagination déterministe, comme dans
        `BaseRepository.list`.
        """
        requete = select(SessionFormation).where(
            SessionFormation.id_formation == id_formation
        )
        if not inclure_supprimes:
            requete = requete.where(SessionFormation.supprime_le.is_(None))
        requete = requete.order_by(SessionFormation.id_session).offset(skip)
        if limit is not None:
            requete = requete.limit(limit)
        return self.db.scalars(requete).all()

    def lister_par_statut(
        self,
        statut: StatutSessionFormation | None = None,
        skip: int = 0,
        limit: int | None = None,
        inclure_supprimes: bool = False,
    ) -> Sequence[SessionFormation]:
        """Retourne les sessions **actives**, filtrées par statut si demandé.

        Un statut sans session donne une liste vide, pas une erreur : c'est un
        critère de recherche, pas une ressource désignée par l'URL.
        """
        requete = select(SessionFormation)
        if statut is not None:
            requete = requete.where(SessionFormation.statut == statut)
        if not inclure_supprimes:
            requete = requete.where(SessionFormation.supprime_le.is_(None))
        requete = requete.order_by(SessionFormation.id_session).offset(skip)
        if limit is not None:
            requete = requete.limit(limit)
        return self.db.scalars(requete).all()
