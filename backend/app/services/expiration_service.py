"""Expiration des impayés : commandes et réservations (13 octobre 2026).

Orchestration de deux entités — `COMMANDE` et `RESERVATION` — d'où un
service à part, comme le prévoit la règle SRP (`docs/architecture.md`) :
chacune garde sa propre façon d'être annulée (`CommandeService` rend le
stock, `ReservationService` rend les places et annule la chambre liée), ce
service ne fait que décider **lesquelles** ont dépassé leur délai.

Pourquoi : un faux client pouvait commander tout le stock, ou retenir une
salle, sans jamais payer. Décisions de l'utilisateur : commande annulée
après 2 h sans paiement, réservation après 24 h sans acompte (`Settings`).
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflitMetier
from app.core.logging import get_logger
from app.models.commande import Commande, StatutCommande
from app.models.reservation import Reservation, StatutReservation
from app.repositories.paiement_repository import PaiementRepository
from app.services.commande_service import CommandeService
from app.services.reservation_service import ReservationService

journal = get_logger(__name__)


@dataclass(frozen=True)
class BilanExpiration:
    """Ce qu'une passe a annulé — pour le journal et le script."""

    commandes: list[int]
    reservations: list[int]


class ExpirationService:
    """Annule les commandes et réservations restées impayées trop longtemps."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.paiements = PaiementRepository(db)

    def expirer(self, maintenant: datetime | None = None) -> BilanExpiration:
        """Une passe complète. Idempotente : rejouée, elle ne trouve plus
        rien à annuler. `maintenant` n'existe que pour les tests."""
        maintenant = maintenant or datetime.now(UTC)
        grace = maintenant - timedelta(
            minutes=settings.EXPIRATION_GRACE_PAIEMENT_MINUTES
        )
        bilan = BilanExpiration(
            commandes=self._expirer_commandes(maintenant, grace),
            reservations=self._expirer_reservations(maintenant, grace),
        )
        if bilan.commandes or bilan.reservations:
            journal.info(
                "Impayés expirés — commandes %s, réservations %s",
                bilan.commandes,
                bilan.reservations,
            )
        return bilan

    def _expirer_commandes(self, maintenant: datetime, grace: datetime) -> list[int]:
        """Commandes `En_attente` passées par un client, plus vieilles que le
        délai. Une commande saisie par le personnel se règle au comptoir et
        n'expire jamais ; un paiement réussi l'aurait déjà confirmée."""
        limite = maintenant - timedelta(
            minutes=settings.COMMANDE_DELAI_PAIEMENT_MINUTES
        )
        candidates = self.db.scalars(
            select(Commande.id_commande).where(
                Commande.statut == StatutCommande.EN_ATTENTE,
                Commande.id_personnel.is_(None),
                Commande.date_commande < limite,
                Commande.supprime_le.is_(None),
            )
        ).all()
        service = CommandeService(self.db)
        annulees = []
        for id_commande in candidates:
            if self.paiements.existe_en_cours_depuis(grace, id_commande=id_commande):
                continue
            try:
                service.annuler(id_commande)
            except ConflitMetier:
                # Son statut a changé entre la lecture et l'annulation (un
                # paiement vient d'aboutir, un administrateur l'a traitée) :
                # elle n'est plus à expirer.
                self.db.rollback()
                continue
            annulees.append(id_commande)
        return annulees

    def _expirer_reservations(self, maintenant: datetime, grace: datetime) -> list[int]:
        """Réservations `En_attente` qui demandent un acompte, plus vieilles
        que le délai, sans acompte payé. Leur annulation rend les places et
        annule la chambre liée (`ReservationService.changer_statut`)."""
        limite = maintenant - timedelta(hours=settings.RESERVATION_DELAI_ACOMPTE_HEURES)
        candidates = self.db.scalars(
            select(Reservation.id_reservation).where(
                Reservation.statut == StatutReservation.EN_ATTENTE,
                Reservation.montant_acompte.is_not(None),
                Reservation.date_reservation < limite,
                Reservation.supprime_le.is_(None),
            )
        ).all()
        service = ReservationService(self.db)
        annulees = []
        for id_reservation in candidates:
            if self.paiements.existe_reussi_pour_reservation(
                id_reservation
            ) or self.paiements.existe_en_cours_depuis(
                grace, id_reservation=id_reservation
            ):
                continue
            service.changer_statut(id_reservation, StatutReservation.ANNULEE)
            annulees.append(id_reservation)
        return annulees
