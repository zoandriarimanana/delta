"""Modèle SQLAlchemy de l'entité SESSION_FORMATION."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.formation import Formation
    from app.models.personnel import Personnel
    from app.models.reservation import Reservation


class SessionFormation(SoftDeleteMixin, Base):
    """Occurrence datée d'une FORMATION, animée par un formateur.

    `id_formateur` est nullable : une session peut être ouverte à la
    réservation avant qu'un formateur ne lui soit affecté. La contrainte
    « le personnel référencé a la fonction Formateur » n'est pas exprimable
    en clé étrangère et relève de la couche `services/` (sprint 4).

    `statut` reste une chaîne libre : le MLD n'en fixe pas le domaine.
    """

    __tablename__ = "session_formation"

    id_session: Mapped[int] = mapped_column(primary_key=True)
    date_debut: Mapped[date] = mapped_column(Date, nullable=False)
    date_fin: Mapped[date] = mapped_column(Date, nullable=False)
    places_restantes: Mapped[int] = mapped_column(nullable=False)
    statut: Mapped[str] = mapped_column(String(30), nullable=False)
    id_formation: Mapped[int] = mapped_column(
        ForeignKey("formation.id_formation", ondelete="RESTRICT"), nullable=False
    )
    id_formateur: Mapped[int | None] = mapped_column(
        ForeignKey("personnel.id_personnel")
    )

    formation: Mapped[Formation] = relationship(back_populates="sessions")
    formateur: Mapped[Personnel | None] = relationship(
        back_populates="sessions_formation"
    )
    reservations: Mapped[list[Reservation]] = relationship(back_populates="session")
