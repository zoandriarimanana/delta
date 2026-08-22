"""Service métier de RESERVATION.

Un invariant porté ici, qu'aucune contrainte de base ne garantit : **le compteur
de places d'une session ne dérive jamais**. Chaque réservation en consomme
exactement autant que de personnes, chaque annulation les rend, et une annulation
rejouée ne rend rien de plus.
"""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.models.client import Client
from app.models.reservation import Reservation, StatutReservation
from app.models.session_formation import StatutSessionFormation
from app.repositories.reservation_repository import ReservationRepository
from app.repositories.session_formation_repository import SessionFormationRepository
from app.schemas.reservation import ReservationCreate

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

        reservation = self.reservations.create(
            {
                "type_reservation": donnees.type_reservation,
                "date_debut": donnees.date_debut,
                "date_fin": donnees.date_fin,
                "nombre_personnes": donnees.nombre_personnes,
                "statut": StatutReservation.EN_ATTENTE,
                "id_client": client.id_client,
                "id_session": donnees.id_session,
            }
        )
        self.db.commit()
        # Le décrément est fait en SQL : l'objet en session porte un compteur
        # périmé tant qu'on ne le rafraîchit pas.
        self.db.refresh(session)
        return reservation

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
