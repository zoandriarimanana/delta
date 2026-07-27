"""Modèle SQLAlchemy de l'entité FORMATION."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.domaine_formation import DomaineFormation
    from app.models.session_formation import SessionFormation


class Formation(SoftDeleteMixin, Base):
    """Formation du catalogue, déclinée en sessions datées.

    `niveau` reste une chaîne libre : le MLD n'en fixe pas le domaine.
    """

    __tablename__ = "formation"

    id_formation: Mapped[int] = mapped_column(primary_key=True)
    titre: Mapped[str] = mapped_column(String(200), nullable=False)
    niveau: Mapped[str | None] = mapped_column(String(50))
    duree_heures: Mapped[int] = mapped_column(nullable=False)
    prix: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    capacite_max: Mapped[int] = mapped_column(nullable=False)
    propose_hebergement: Mapped[bool] = mapped_column(
        nullable=False, server_default="false"
    )
    id_domaine: Mapped[int] = mapped_column(
        ForeignKey("domaine_formation.id_domaine", ondelete="RESTRICT"),
        nullable=False,
    )

    domaine: Mapped[DomaineFormation] = relationship(back_populates="formations")
    sessions: Mapped[list[SessionFormation]] = relationship(
        back_populates="formation", passive_deletes=True
    )
