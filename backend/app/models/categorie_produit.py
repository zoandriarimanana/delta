"""Modèle SQLAlchemy de l'entité CATEGORIE_PRODUIT."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.produit import Produit


class CategorieProduit(Base):
    """Catégorie de produit (pâtisserie, boulangerie, confiture...)."""

    __tablename__ = "categorie_produit"

    id_categorie: Mapped[int] = mapped_column(primary_key=True)
    libelle: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    produits: Mapped[list[Produit]] = relationship(
        back_populates="categorie", passive_deletes=True
    )
