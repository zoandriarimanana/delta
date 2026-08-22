"""Repository de l'entité RESERVATION."""

from collections.abc import Sequence

from sqlalchemy import select

from app.models.reservation import Reservation
from app.repositories.base_repository import BaseRepository


class ReservationRepository(BaseRepository[Reservation]):
    """CRUD générique, plus les recherches par client et par session."""

    modele = Reservation

    def lister_par_client(
        self, id_client: int, inclure_supprimes: bool = False
    ) -> Sequence[Reservation]:
        """Retourne les réservations **actives** d'un client, les plus récentes
        d'abord.

        Le filtre par client vient toujours de l'appelant authentifié, jamais
        d'un paramètre de requête : c'est ce qui garantit qu'un client ne lit
        pas les réservations d'un autre — même règle que
        `CommandeRepository.lister_par_client`.
        """
        requete = select(Reservation).where(Reservation.id_client == id_client)
        if not inclure_supprimes:
            requete = requete.where(Reservation.supprime_le.is_(None))
        return self.db.scalars(
            requete.order_by(Reservation.id_reservation.desc())
        ).all()

    def lister_par_session(
        self, id_session: int, inclure_supprimes: bool = False
    ) -> Sequence[Reservation]:
        """Retourne les réservations **actives** portant sur une session.

        Le filtre sur `supprime_le` n'est pas hérité : cette requête est écrite
        ici et ne passe pas par `list()`.
        """
        requete = select(Reservation).where(Reservation.id_session == id_session)
        if not inclure_supprimes:
            requete = requete.where(Reservation.supprime_le.is_(None))
        return self.db.scalars(requete.order_by(Reservation.id_reservation)).all()
