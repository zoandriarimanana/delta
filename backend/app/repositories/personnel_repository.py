"""Repository de l'entité PERSONNEL."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.personnel import FonctionPersonnel, Personnel
from app.repositories.base_repository import BaseRepository


class PersonnelRepository(BaseRepository[Personnel]):
    """CRUD générique, plus la recherche par e-mail et par fonction."""

    modele = Personnel

    def get_by_email(
        self, email: str, inclure_supprimes: bool = False
    ) -> Personnel | None:
        """Retourne le membre du personnel **actif** portant cet e-mail, ou None.

        Même raisonnement que `ClientRepository.get_by_email` :
        `uq_personnel_email` est un index *partiel*, donc plusieurs lignes
        peuvent légitimement partager une adresse — une active et autant
        d'archivées qu'on veut, ce qui correspond au départ puis au retour d'un
        salarié. Sans le filtre, `one_or_none()` lèverait `MultipleResultsFound`
        dès la première réembauche.

        `inclure_supprimes=True` lève le filtre et peut donc remonter plusieurs
        lignes : on retourne alors la première, l'appelant devant savoir ce
        qu'il consulte.
        """
        requete = select(Personnel).where(Personnel.email == email)
        if not inclure_supprimes:
            requete = requete.where(Personnel.supprime_le.is_(None))
            return self.db.scalars(requete).one_or_none()
        return self.db.scalars(requete).first()

    def lister_par_fonction(
        self,
        fonction: FonctionPersonnel,
        skip: int = 0,
        limit: int | None = None,
        inclure_supprimes: bool = False,
    ) -> Sequence[Personnel]:
        """Retourne les membres **actifs** exerçant une fonction donnée.

        C'est la requête dont dépendront les sprints suivants : proposer les
        livreurs affectables à une livraison (#25), les formateurs affectables à
        une session (sprint 4). Elle ne vérifie rien — c'est au service de
        refuser une affectation incohérente, la FK pointant vers `PERSONNEL`
        tout entier.

        Le filtre sur `supprime_le` n'est pas hérité : cette requête est écrite
        ici et ne passe pas par `list()`. Sans lui, un salarié archivé
        apparaîtrait parmi les affectables.

        Le tri sur la clé primaire rend la pagination déterministe, comme dans
        `BaseRepository.list`.
        """
        requete = select(Personnel).where(Personnel.fonction == fonction)
        if not inclure_supprimes:
            requete = requete.where(Personnel.supprime_le.is_(None))
        requete = requete.order_by(Personnel.id_personnel).offset(skip)
        if limit is not None:
            requete = requete.limit(limit)
        return self.db.scalars(requete).all()
