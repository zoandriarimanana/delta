"""Repository de l'entité RESERVATION."""

from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from typing import NamedTuple

from sqlalchemy import func, select

from app.models.formation import Formation
from app.models.reservation import Reservation, StatutReservation, TypeReservation
from app.models.session_formation import SessionFormation
from app.repositories.base_repository import BaseRepository


class InscriptionsFormation(NamedTuple):
    """Inscriptions cumulées d'une formation sur une période."""

    id_formation: int
    titre: str
    inscrits: int
    chiffre_affaires: Decimal
    nombre_reservations: int


class ReservationRepository(BaseRepository[Reservation]):
    """CRUD générique, plus les recherches par client et par session."""

    modele = Reservation

    def lister_recentes(self, inclure_supprimes: bool = False) -> Sequence[Reservation]:
        """Toutes les réservations actives, **les plus récentes d'abord**
        (demande du 13 octobre 2026).

        `RESERVATION` ne porte pas de date de création : l'identifiant, tiré
        d'une séquence dans l'ordre où les réservations sont faites, en tient
        lieu. `list()` triait par identifiant croissant, et l'écran
        d'administration ouvrait sur les plus anciennes.
        """
        requete = select(Reservation).order_by(Reservation.id_reservation.desc())
        if not inclure_supprimes:
            requete = requete.where(Reservation.supprime_le.is_(None))
        return self.db.scalars(requete).all()

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

    def lister_par_salle(
        self, id_salle: int, inclure_supprimes: bool = False
    ) -> Sequence[Reservation]:
        """Retourne les réservations **actives** portant sur une salle.

        Sert le pré-contrôle d'archivage : on ne retire pas du catalogue une
        salle que quelqu'un a réservée. Le filtre sur `supprime_le` n'est pas
        hérité, cette requête ne passe pas par `list()`.
        """
        requete = select(Reservation).where(Reservation.id_salle == id_salle)
        if not inclure_supprimes:
            requete = requete.where(Reservation.supprime_le.is_(None))
        return self.db.scalars(requete.order_by(Reservation.id_reservation)).all()

    def lister_par_logement(
        self, id_logement: int, inclure_supprimes: bool = False
    ) -> Sequence[Reservation]:
        """Retourne les réservations **actives** portant sur un logement.

        Sert le pré-contrôle d'archivage, comme `lister_par_salle`. Le filtre sur
        `supprime_le` n'est pas hérité, cette requête ne passe pas par `list()`.
        """
        requete = select(Reservation).where(Reservation.id_logement == id_logement)
        if not inclure_supprimes:
            requete = requete.where(Reservation.supprime_le.is_(None))
        return self.db.scalars(requete.order_by(Reservation.id_reservation)).all()

    def inscriptions_par_formation(
        self, statuts: Sequence[StatutReservation], depuis: datetime | None
    ) -> list[InscriptionsFormation]:
        """Inscrits (personnes), chiffre d'affaires figé et nombre de
        réservations par formation, sur les réservations de type
        `Formation` aux `statuts` donnés, faites depuis `depuis` (tout
        l'historique si `None`). Les archivées comptent ; une réservation
        sans prix figé (antérieure) vaut 0."""
        requete = (
            select(
                Formation.id_formation,
                Formation.titre,
                func.sum(Reservation.nombre_personnes),
                func.sum(func.coalesce(Reservation.montant_total, 0)),
                func.count(Reservation.id_reservation),
            )
            .join(
                SessionFormation, SessionFormation.id_session == Reservation.id_session
            )
            .join(Formation, Formation.id_formation == SessionFormation.id_formation)
            .where(
                Reservation.type_reservation == TypeReservation.FORMATION,
                Reservation.statut.in_(list(statuts)),
            )
            .group_by(Formation.id_formation, Formation.titre)
        )
        if depuis is not None:
            requete = requete.where(Reservation.date_reservation >= depuis)
        return [
            InscriptionsFormation(int(i), titre, int(n or 0), Decimal(m or 0), int(r))
            for i, titre, n, m, r in self.db.execute(requete).all()
        ]
