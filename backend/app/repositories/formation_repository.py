"""Repository de l'entité FORMATION."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.formation import Formation
from app.repositories.base_repository import BaseRepository


class FormationRepository(BaseRepository[Formation]):
    """CRUD générique, plus la recherche par domaine."""

    modele = Formation

    def rechercher_par_domaine(
        self,
        id_domaine: int,
        skip: int = 0,
        limit: int | None = None,
        inclure_supprimes: bool = False,
    ) -> Sequence[Formation]:
        """Retourne les formations **actives** d'un domaine donné.

        Un domaine inexistant donne une liste vide, pas une erreur : le filtre
        est un critère de recherche, pas la désignation d'une ressource.

        Le filtre sur `supprime_le` n'est pas hérité — cette requête est écrite
        ici et ne passe pas par `list()`. Sans lui, deux incohérences
        apparaîtraient, les mêmes que celles corrigées sur `PRODUIT` : le
        catalogue filtré montrerait des formations archivées que le catalogue
        complet masque, et le pré-contrôle d'archivage d'un domaine compterait
        des formations déjà archivées, refusant à tort de l'archiver.

        Le tri sur la clé primaire rend la pagination déterministe, comme dans
        `BaseRepository.list`.
        """
        requete = select(Formation).where(Formation.id_domaine == id_domaine)
        if not inclure_supprimes:
            requete = requete.where(Formation.supprime_le.is_(None))
        requete = requete.order_by(Formation.id_formation).offset(skip)
        if limit is not None:
            requete = requete.limit(limit)
        return self.db.scalars(requete).all()
