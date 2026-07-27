"""Modèle SQLAlchemy de l'entité DOMAINE_FORMATION."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.formation import Formation


class DomaineFormation(Base):
    """Domaine regroupant plusieurs formations (pâtisserie, cuisine...)."""

    __tablename__ = "domaine_formation"

    id_domaine: Mapped[int] = mapped_column(primary_key=True)
    libelle: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    formations: Mapped[list[Formation]] = relationship(
        back_populates="domaine", passive_deletes=True
    )
