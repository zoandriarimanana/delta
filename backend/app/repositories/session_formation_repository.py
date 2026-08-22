"""Repository de l'entité SESSION_FORMATION."""

from collections.abc import Sequence

from sqlalchemy import select, update

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

    def decrementer_places(self, id_session: int, nombre: int) -> bool:
        """Retire `nombre` places si — et seulement si — il en reste assez.

        **UPDATE conditionnel atomique**, exactement comme
        `ProduitRepository.decrementer_stock`. La condition
        `places_restantes >= nombre` est évaluée par PostgreSQL au moment de
        l'écriture, sous le verrou de ligne : deux réservations simultanées sur
        la dernière place ne peuvent pas réussir toutes les deux. Une lecture
        suivie d'une écriture séparée laisserait passer les deux, et le
        compteur deviendrait négatif.

        Retourne `False` si aucune ligne n'a été touchée : places insuffisantes,
        ou session inexistante ou archivée. L'appelant distingue les deux cas.

        `synchronize_session=False` : la mise à jour est faite en SQL, sans
        passer par les objets en session. Ceux déjà chargés portent donc un
        compteur périmé — l'appelant doit les rafraîchir s'il les relit.
        """
        resultat = self.db.execute(
            update(SessionFormation)
            .where(
                SessionFormation.id_session == id_session,
                SessionFormation.supprime_le.is_(None),
                SessionFormation.places_restantes >= nombre,
            )
            .values(places_restantes=SessionFormation.places_restantes - nombre)
            .execution_options(synchronize_session=False)
        )
        return resultat.rowcount == 1

    def crediter_places(self, id_session: int, nombre: int) -> None:
        """Rend `nombre` places à la session.

        Le symétrique de `decrementer_places`, et il n'est pas optionnel : sans
        lui, chaque annulation perdrait une place définitivement. Au bout de
        quelques cycles, une session afficherait complet alors que la salle est
        vide, et rien dans les données ne dirait pourquoi.

        **Sans condition, contrairement au décrément.** Il n'y a rien à
        arbitrer : la place a été prise, elle revient. L'idempotence est portée
        par le service, qui ne crédite qu'à la transition vers `Annulee` — la
        garder ici obligerait le repository à connaître le statut des
        réservations, qui ne le regarde pas.
        """
        self.db.execute(
            update(SessionFormation)
            .where(SessionFormation.id_session == id_session)
            .values(places_restantes=SessionFormation.places_restantes + nombre)
            .execution_options(synchronize_session=False)
        )
