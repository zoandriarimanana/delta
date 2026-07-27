"""Modèle SQLAlchemy de l'entité PRODUIT."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.categorie_produit import CategorieProduit
    from app.models.demande_personnalisation import DemandePersonnalisation
    from app.models.ligne_commande import LigneCommande


class Produit(Base):
    """Produit vendable (pâtisserie, boulangerie, confiture...)."""

    __tablename__ = "produit"

    id_produit: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    prix_unitaire: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    unite_mesure: Mapped[str] = mapped_column(String(30), nullable=False)
    stock_disponible: Mapped[int] = mapped_column(nullable=False, server_default="0")
    est_personnalisable: Mapped[bool] = mapped_column(
        nullable=False, server_default="false"
    )
    est_livrable: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    id_categorie: Mapped[int] = mapped_column(
        ForeignKey("categorie_produit.id_categorie", ondelete="RESTRICT"),
        nullable=False,
    )

    categorie: Mapped[CategorieProduit] = relationship(back_populates="produits")
    lignes_commande: Mapped[list[LigneCommande]] = relationship(
        back_populates="produit", passive_deletes=True
    )
    personnalisations: Mapped[list[DemandePersonnalisation]] = relationship(
        back_populates="produit_base", passive_deletes=True
    )
