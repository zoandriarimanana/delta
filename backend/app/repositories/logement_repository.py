"""Repository de l'entité LOGEMENT."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import and_, exists, select

from app.models.logement import Logement, StatutLogement
from app.models.reservation import Reservation, StatutReservation
from app.repositories.base_repository import BaseRepository


class LogementRepository(BaseRepository[Logement]):
    """CRUD générique, plus les recherches par statut, capacité et créneau."""

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

    def premier_libre(
        self,
        date_debut: datetime,
        date_fin: datetime,
        capacite_minimale: int,
    ) -> Logement | None:
        """Retourne le premier logement louable et libre sur ce créneau, ou None.

        Sert le couplage formation ↔ hébergement : la chambre est choisie **côté
        serveur** et non par le client, qui ne dispose d'aucune vue de
        disponibilité (cf. `docs/roadmap.md`, Sprint 6).

        Trois filtres, et aucun n'est optionnel :

        - le logement est **actif** — un logement archivé n'existe plus ;
        - son statut est `Disponible` — `En_maintenance` et `Hors_service`
          disent précisément qu'il n'est pas louable, et le service refuserait
          en 409 une réservation directe sur un tel bien ;
        - **aucune réservation occupante ne recoupe le créneau**.

        Le prédicat de chevauchement reproduit **exactement** celui de la
        contrainte d'exclusion `logement_sans_chevauchement` : bornes `[)`, donc
        `debut < fin_existante AND fin > debut_existante`, réservations annulées
        et archivées écartées. Diverger donnerait une chambre proposée ici puis
        refusée par la base — ou l'inverse, une chambre libre jamais proposée.

        **Ce n'est pas la garantie.** Deux formations simultanées peuvent lire
        la même chambre libre ; c'est la contrainte d'exclusion qui tranche à
        l'écriture, comme pour toute réservation de bien. Il n'y a ici aucun
        compteur sur lequel poser un verrou de ligne.

        `None` signifie « aucune chambre libre », ce qui n'est pas une erreur :
        la réservation de formation est acceptée quand même, l'hébergement
        restant non honoré.

        Le tri sur la clé primaire rend le choix **déterministe** : « la
        première libre » doit désigner la même chambre d'un appel à l'autre,
        sans quoi deux exécutions identiques donneraient des résultats
        différents et aucun test ne serait reproductible.
        """
        occupee = exists().where(
            and_(
                Reservation.id_logement == Logement.id_logement,
                Reservation.supprime_le.is_(None),
                Reservation.statut != StatutReservation.ANNULEE,
                Reservation.date_debut < date_fin,
                Reservation.date_fin > date_debut,
            )
        )
        requete = (
            select(Logement)
            .where(
                Logement.supprime_le.is_(None),
                Logement.statut == StatutLogement.DISPONIBLE,
                Logement.capacite >= capacite_minimale,
                ~occupee,
            )
            .order_by(Logement.id_logement)
            .limit(1)
        )
        return self.db.scalars(requete).first()
