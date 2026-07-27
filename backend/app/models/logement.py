"""Modèle SQLAlchemy de l'entité LOGEMENT."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.reservation import Reservation


class Logement(SoftDeleteMixin, Base):
    """Chambre / logement proposé à la nuitée.

    `statut` reste une chaîne libre : le MLD n'en fixe pas le domaine.
    """

    __tablename__ = "logement"

    id_logement: Mapped[int] = mapped_column(primary_key=True)
    type_chambre: Mapped[str] = mapped_column(String(50), nullable=False)
    capacite: Mapped[int] = mapped_column(nullable=False)
    tarif_nuitee: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    statut: Mapped[str] = mapped_column(String(30), nullable=False)

    reservations: Mapped[list[Reservation]] = relationship(back_populates="logement")
