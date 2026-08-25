"""Service métier de RESERVATION.

Un invariant porté ici, qu'aucune contrainte de base ne garantit : **le compteur
de places d'une session ne dérive jamais**. Chaque réservation en consomme
exactement autant que de personnes, chaque annulation les rend, et une annulation
rejouée ne rend rien de plus.
"""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.models.client import Client
from app.models.logement import StatutLogement
from app.models.reservation import (
    Reservation,
    StatutReservation,
    TypeReservation,
)
from app.models.session_formation import SessionFormation, StatutSessionFormation
from app.repositories.logement_repository import LogementRepository
from app.repositories.reservation_repository import ReservationRepository
from app.repositories.salle_repository import SalleRepository
from app.repositories.session_formation_repository import SessionFormationRepository
from app.schemas.reservation import ReservationCreate

#: Noms des contraintes d'exclusion posées sur `RESERVATION` (migration
#: acadf9ddce27). PostgreSQL les remonte dans `diag.constraint_name`, comme pour
#: les index uniques partiels — c'est le seul discriminant fiable.
CONTRAINTES_EXCLUSION = ("salle_sans_chevauchement", "logement_sans_chevauchement")


def _viole_exclusion(erreur: IntegrityError) -> bool:
    """Distingue une violation de chevauchement d'une autre violation.

    Sans ce test, le service traduirait n'importe quelle `IntegrityError` en
    « déjà réservée », y compris une clé étrangère cassée — même raisonnement que
    `core/integrite.viole_contrainte`, qu'on n'emploie pas ici parce qu'il faut
    accepter **deux** noms possibles.
    """
    nom = getattr(getattr(erreur.orig, "diag", None), "constraint_name", None)
    return nom in CONTRAINTES_EXCLUSION


#: Statuts qui immobilisent une place. Une réservation annulée ne consomme plus
#: rien ; une réservation honorée a consommé la sienne définitivement.
STATUTS_OCCUPANTS: frozenset[StatutReservation] = frozenset(
    {
        StatutReservation.EN_ATTENTE,
        StatutReservation.CONFIRMEE,
        StatutReservation.HONOREE,
    }
)


class ReservationService:
    """Cycle de vie d'une réservation, et compteur de places de la session."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.reservations = ReservationRepository(db)
        self.sessions = SessionFormationRepository(db)
        self.salles = SalleRepository(db)
        self.logements = LogementRepository(db)

    # --- Lecture --------------------------------------------------------------

    def obtenir(self, id_reservation: int) -> Reservation:
        """Retourne une réservation, ou lève `RessourceIntrouvable` (404)."""
        reservation = self.reservations.get_by_id(id_reservation)
        if reservation is None:
            raise RessourceIntrouvable("Réservation introuvable.")
        return reservation

    def obtenir_du_client(self, id_reservation: int, client: Client) -> Reservation:
        """Retourne une réservation du client connecté, ou 404.

        **404 et non 403** sur la réservation d'un autre : confirmer son
        existence renseignerait déjà. Même règle que `GET /commandes/{id}`.
        """
        reservation = self.obtenir(id_reservation)
        if reservation.id_client != client.id_client:
            raise RessourceIntrouvable("Réservation introuvable.")
        return reservation

    def lister_du_client(self, client: Client) -> Sequence[Reservation]:
        """Historique des réservations d'un client, les plus récentes d'abord."""
        return self.reservations.lister_par_client(client.id_client)

    # --- Création -------------------------------------------------------------

    def creer(self, donnees: ReservationCreate, client: Client) -> Reservation:
        """Crée une réservation, quel que soit son type.

        Les trois types ne se ressemblent pas : une session a un **compteur de
        places**, une salle et un logement ont un **calendrier**. Le premier se
        protège par un `UPDATE` conditionnel atomique, les seconds par une
        contrainte d'exclusion en base — il n'y a pas de compteur sur lequel
        poser un verrou de ligne.

        L'aiguillage est explicite plutôt que polymorphe : trois cas nommés se
        lisent, une hiérarchie de classes pour trois branches se devine.
        """
        if donnees.type_reservation is TypeReservation.FORMATION:
            return self._creer_sur_session(donnees, client)
        if donnees.type_reservation is TypeReservation.SALLE:
            return self._creer_sur_bien(donnees, client, "salle")
        if donnees.type_reservation is TypeReservation.LOGEMENT:
            return self._creer_sur_bien(donnees, client, "logement")
        return self._creer_ligne(donnees, client)

    def _creer_sur_session(
        self, donnees: ReservationCreate, client: Client
    ) -> Reservation:
        """Réserve des places sur une session, ou refuse.

        **Le décrément est immédiat et atomique.** `decrementer_places` émet un
        `UPDATE` conditionnel `WHERE places_restantes >= :n` : c'est PostgreSQL
        qui arbitre entre deux réservations simultanées sur la dernière place,
        sous le verrou de ligne. Une lecture suivie d'une écriture séparée
        laisserait passer les deux, et le compteur deviendrait négatif.

        Immédiat et non conditionné au statut : réserver sans payer immobilise
        une place, ce qui est le comportement attendu — la place est retenue
        tant que la réservation vit. C'est l'annulation qui la rend.

        Le décrément précède l'insertion : si les places manquent, aucune ligne
        n'est écrite. L'ordre inverse créerait une réservation qu'il faudrait
        ensuite défaire.
        """
        session = self.sessions.get_by_id(donnees.id_session)  # type: ignore[arg-type]
        if session is None:
            raise ReferenceInvalide(
                f"Aucune session ne porte l'identifiant {donnees.id_session}."
            )

        self._verifier_hebergement(donnees, session)

        if session.statut is not StatutSessionFormation.OUVERTE:
            raise ConflitMetier(
                f"Cette session est « {session.statut.value} » : "
                "elle n'accepte pas de réservation."
            )

        if not self.sessions.decrementer_places(
            session.id_session, donnees.nombre_personnes
        ):
            raise ConflitMetier(
                f"Il ne reste que {session.places_restantes} place(s) sur cette "
                f"session, {donnees.nombre_personnes} demandée(s)."
            )

        reservation = self._creer_ligne(donnees, client)
        # Le décrément est fait en SQL : l'objet en session porte un compteur
        # périmé tant qu'on ne le rafraîchit pas.
        self.db.refresh(session)
        return reservation

    def _creer_ligne(self, donnees: ReservationCreate, client: Client) -> Reservation:
        """Écrit la ligne et commite. Commun aux trois types.

        `statut` et `id_client` ne viennent jamais de la requête : le premier est
        un cycle de vie, le second est déduit du jeton.
        """
        reservation = self.reservations.create(
            {
                "type_reservation": donnees.type_reservation,
                "date_debut": donnees.date_debut,
                "date_fin": donnees.date_fin,
                "nombre_personnes": donnees.nombre_personnes,
                "statut": StatutReservation.EN_ATTENTE,
                "id_client": client.id_client,
                "id_session": donnees.id_session,
                "id_salle": donnees.id_salle,
                "id_logement": donnees.id_logement,
                "avec_hebergement": donnees.avec_hebergement,
            }
        )
        self.db.commit()
        return reservation

    # --- Salles et logements --------------------------------------------------

    def _creer_sur_bien(
        self, donnees: ReservationCreate, client: Client, genre: str
    ) -> Reservation:
        """Réserve une salle ou un logement sur un créneau, ou refuse.

        **La garantie contre le double usage est la contrainte d'exclusion**,
        posée en base : `EXCLUDE USING gist` refuse deux réservations actives
        dont les intervalles se recoupent sur le même bien. Contrairement au
        compteur de places d'une session, il n'y a ici aucune ligne à verrouiller
        — une vérification applicative seule laisserait passer deux requêtes
        simultanées.

        Le pré-contrôle qui la précède ne remplace pas cette garantie : il
        produit un **409 lisible** disant quel créneau est déjà pris, plutôt
        qu'une erreur d'intégrité brute. Même architecture à deux niveaux que
        l'unicité d'e-mail depuis T0.6.

        L'interception de l'`IntegrityError` couvre la course entre le
        pré-contrôle et le `commit` : c'est là, et là seulement, que la base
        tranche réellement.
        """
        bien = self._bien_reservable(donnees, genre)
        colonne = "id_salle" if genre == "salle" else "id_logement"
        identifiant = getattr(donnees, colonne)

        if donnees.nombre_personnes > bien.capacite:
            raise ReferenceInvalide(
                f"Cette {genre} accueille {bien.capacite} personne(s), "
                f"{donnees.nombre_personnes} demandée(s)."
            )

        if self._chevauche(colonne, identifiant, donnees):
            raise ConflitMetier(f"Cette {genre} est déjà réservée sur ce créneau.")

        try:
            return self._creer_ligne(donnees, client)
        except IntegrityError as erreur:
            self.db.rollback()
            if _viole_exclusion(erreur):
                raise ConflitMetier(
                    f"Cette {genre} est déjà réservée sur ce créneau."
                ) from erreur
            raise

    def _bien_reservable(self, donnees: ReservationCreate, genre: str):
        """Charge la salle ou le logement visé, ou lève 422.

        Un bien **archivé** est traité comme inexistant — `get_by_id` le filtre.
        Un logement qui n'est pas `Disponible` est refusé : `En_maintenance` et
        `Hors_service` disent précisément qu'il n'est pas louable. `SALLE` n'a
        pas d'équivalent, elle ne porte pas de statut.
        """
        if genre == "salle":
            bien = self.salles.get_by_id(donnees.id_salle)  # type: ignore[arg-type]
            if bien is None:
                raise ReferenceInvalide(
                    f"Aucune salle ne porte l'identifiant {donnees.id_salle}."
                )
            return bien

        bien = self.logements.get_by_id(donnees.id_logement)  # type: ignore[arg-type]
        if bien is None:
            raise ReferenceInvalide(
                f"Aucun logement ne porte l'identifiant {donnees.id_logement}."
            )
        if bien.statut is not StatutLogement.DISPONIBLE:
            raise ConflitMetier(
                f"Ce logement est « {bien.statut.value} » : " "il n'est pas réservable."
            )
        return bien

    def _chevauche(
        self, colonne: str, identifiant: int, donnees: ReservationCreate
    ) -> bool:
        """Indique si une réservation active recoupe déjà ce créneau.

        Le test reproduit **exactement** le prédicat de la contrainte
        d'exclusion : bornes `[)` — `debut < fin_existante AND fin >
        debut_existante` —, réservations annulées et archivées exclues. Deux
        créneaux adjacents ne se chevauchent pas.

        Diverger de la contrainte donnerait un pré-contrôle qui laisse passer ce
        que la base refuse, ou l'inverse : un 409 sur un créneau libre.
        """
        cible = getattr(Reservation, colonne)
        requete = (
            select(Reservation.id_reservation)
            .where(
                cible == identifiant,
                Reservation.supprime_le.is_(None),
                Reservation.statut != StatutReservation.ANNULEE,
                Reservation.date_debut < donnees.date_fin,
                Reservation.date_fin > donnees.date_debut,
            )
            .limit(1)
        )
        return self.db.scalars(requete).first() is not None

    def _verifier_hebergement(
        self, donnees: ReservationCreate, session: SessionFormation
    ) -> None:
        """Refuse en 422 un hébergement que la formation ne propose pas.

        `FORMATION.propose_hebergement` est une **propriété du catalogue**, pas
        une préférence du client : une formation d'une journée sur place ne loge
        personne parce qu'on le demande. Même raisonnement que
        `PRODUIT.est_personnalisable` en #24.

        La vérification est ici et non dans le schema parce qu'elle demande la
        base : le schema ne voit que la charge utile, pas la formation visée.

        **Portée volontairement limitée.** Ce contrôle dit seulement que
        l'option est offerte. Il ne réserve aucun `LOGEMENT` et ne vérifie
        aucune disponibilité — voir la note de `docs/mld.md`.
        """
        if not donnees.avec_hebergement:
            return

        formation = session.formation
        if not formation.propose_hebergement:
            raise ReferenceInvalide(
                f"La formation « {formation.titre} » ne propose pas " "d'hébergement."
            )

    # --- Statut ---------------------------------------------------------------

    def changer_statut(
        self, id_reservation: int, statut: StatutReservation
    ) -> Reservation:
        """Fait avancer le statut, et restitue la place s'il y a lieu.

        **Seule la transition vers `Annulee` restitue.** Une réservation honorée
        a consommé sa place : la rendre ferait réapparaître une place déjà
        utilisée, et la session afficherait de la disponibilité qui n'existe pas.

        La restitution est **idempotente** : elle n'a lieu qu'au passage d'un
        statut occupant vers `Annulee`. Annuler deux fois ne crédite qu'une
        fois — sans cette garde, chaque appel répété gonflerait le compteur et
        la session finirait par afficher plus de places qu'elle n'en a.

        Le sens est unique : rien ne fait revenir une réservation annulée à un
        statut occupant. Le permettre supposerait de re-décrémenter, donc de
        pouvoir échouer faute de places — une transition de statut qui échoue
        pour cause de capacité serait un piège.
        """
        reservation = self.obtenir(id_reservation)

        if statut is reservation.statut:
            return reservation

        if reservation.statut is StatutReservation.ANNULEE:
            raise ConflitMetier(
                "Cette réservation est annulée : son statut ne peut plus changer."
            )

        if statut is StatutReservation.ANNULEE:
            self._restituer(reservation)

        reservation.statut = statut
        self.db.commit()
        return reservation

    def _restituer(self, reservation: Reservation) -> None:
        """Rend les places d'une réservation qui cesse d'en occuper.

        Ne commite pas : l'appelant écrit le statut dans la **même
        transaction**. Créditer sans changer le statut laisserait une
        réservation vivante sur des places rendues.
        """
        if reservation.statut not in STATUTS_OCCUPANTS:
            return
        if reservation.id_session is None:
            return
        self.sessions.crediter_places(
            reservation.id_session, reservation.nombre_personnes
        )

    # --- Archivage ------------------------------------------------------------

    def supprimer(self, id_reservation: int) -> None:
        """Archive une réservation, **et rend ses places**.

        Une réservation archivée ne compte plus, elle ne doit donc plus
        immobiliser de place. Ne pas restituer ici laisserait exactement le trou
        que l'annulation évite, par un autre chemin.

        `STATUTS_OCCUPANTS` fait que l'archivage d'une réservation déjà annulée
        ne crédite rien : elle avait déjà rendu sa place.
        """
        reservation = self.obtenir(id_reservation)
        self._restituer(reservation)
        self.reservations.delete(reservation)
        self.db.commit()
