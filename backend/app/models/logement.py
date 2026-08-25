"""Modèle SQLAlchemy de l'entité LOGEMENT."""

from __future__ import annotations

from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.reservation import Reservation


class StatutLogement(StrEnum):
    """Domaine de `LOGEMENT.statut` (cf. `docs/mld.md`).

    Domaine formel et non chaîne libre, même traitement que `COMMANDE.statut`,
    `LIVRAISON.statut` et `SESSION_FORMATION.statut`.

    **Il décrit l'état du bien, jamais son occupation.** Aucune valeur
    « Occupé » : savoir si une chambre est prise à une date donnée se déduit des
    `RESERVATION` actives couvrant cette période. L'inscrire aussi dans le
    statut créerait deux sources pour un même fait, qui divergeraient à la
    première annulation — exactement la raison pour laquelle
    `SESSION_FORMATION` n'a pas de statut « Complete ».

    La distinction est concrète : un logement `Disponible` peut être réservé
    demain sans cesser d'être disponible ; un logement `En_maintenance` ne peut
    pas l'être, même si aucune réservation ne le couvre.

    `En_maintenance` et `Hors_service` ne font pas double emploi : l'un dit que
    le bien revient, l'autre qu'il est retiré de l'offre. Les confondre
    effacerait la seule information utile au moment de planifier.
    """

    DISPONIBLE = "Disponible"
    EN_MAINTENANCE = "En_maintenance"
    HORS_SERVICE = "Hors_service"


class Logement(SoftDeleteMixin, Base):
    """Chambre / logement proposé à la nuitée.

    `statut` décrit l'état du bien. Son occupation à une date donnée ne s'y lit
    pas : elle se déduit des réservations.
    """

    __tablename__ = "logement"

    id_logement: Mapped[int] = mapped_column(primary_key=True)
    type_chambre: Mapped[str] = mapped_column(String(50), nullable=False)
    capacite: Mapped[int] = mapped_column(nullable=False)
    tarif_nuitee: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    statut: Mapped[StatutLogement] = mapped_column(
        SAEnum(
            StatutLogement,
            native_enum=False,
            create_constraint=True,
            name="statut_logement",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )

    reservations: Mapped[list[Reservation]] = relationship(back_populates="logement")
