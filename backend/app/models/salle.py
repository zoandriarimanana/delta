"""Modèle SQLAlchemy de l'entité SALLE."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.reservation import Reservation


class Salle(SoftDeleteMixin, Base):
    """Salle louable, tarifée à l'heure et/ou à la journée."""

    __tablename__ = "salle"

    id_salle: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    capacite: Mapped[int] = mapped_column(nullable=False)
    tarif_horaire: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    tarif_journee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    equipements: Mapped[str | None] = mapped_column(Text)

    reservations: Mapped[list[Reservation]] = relationship(back_populates="salle")
