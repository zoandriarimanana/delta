"""Repository de l'entité LIVRAISON."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.livraison import Livraison, StatutLivraison
from app.repositories.base_repository import BaseRepository


class LivraisonRepository(BaseRepository[Livraison]):
    """CRUD générique, plus les recherches par commande et par statut."""

    modele = Livraison

    def get_by_commande(
        self, id_commande: int, inclure_supprimes: bool = False
    ) -> Livraison | None:
        """Retourne la livraison **active** d'une commande, ou None.

        `UNIQUE (id_commande)` est **globale** et non partielle : elle exprime
        une cardinalité (1,1), pas une identité métier. Archiver une livraison ne
        libère donc pas la place, et `one_or_none()` ne peut pas rencontrer de
        doublon — contrairement aux recherches par e-mail, où l'index partiel
        impose le filtre pour éviter `MultipleResultsFound`.
        """
        requete = select(Livraison).where(Livraison.id_commande == id_commande)
        if not inclure_supprimes:
            requete = requete.where(Livraison.supprime_le.is_(None))
        return self.db.scalars(requete).one_or_none()

    def lister_par_statut(
        self,
        statut: StatutLivraison | None = None,
        skip: int = 0,
        limit: int | None = None,
        inclure_supprimes: bool = False,
    ) -> Sequence[Livraison]:
        """Retourne les livraisons **actives**, filtrées par statut si demandé.

        C'est la requête du tableau de bord logistique : « que reste-t-il à
        affecter, qu'est-ce qui est parti ». Un statut sans livraison donne une
        liste vide, pas une erreur : c'est un critère de recherche, pas une
        ressource désignée par l'URL.

        Le filtre sur `supprime_le` n'est pas hérité — la requête est écrite ici
        et ne passe pas par `list()`. Le tri sur la clé primaire rend la
        pagination déterministe, comme dans `BaseRepository.list`.
        """
        requete = select(Livraison)
        if statut is not None:
            requete = requete.where(Livraison.statut == statut)
        if not inclure_supprimes:
            requete = requete.where(Livraison.supprime_le.is_(None))
        requete = requete.order_by(Livraison.id_livraison).offset(skip)
        if limit is not None:
            requete = requete.limit(limit)
        return self.db.scalars(requete).all()
