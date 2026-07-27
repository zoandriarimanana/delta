"""Modèle SQLAlchemy de l'entité DEMANDE_PERSONNALISATION."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.ligne_commande import LigneCommande
    from app.models.produit import Produit


class DemandePersonnalisation(Base):
    """Demande de personnalisation rattachée à une ligne de commande.

    `id_produit_base` désigne le produit servant de point de départ à la
    personnalisation. Il est en principe identique au produit de la ligne,
    mais le MLD le porte explicitement : on le conserve tel quel.
    """

    __tablename__ = "demande_personnalisation"

    id_personnalisation: Mapped[int] = mapped_column(primary_key=True)
    description_demande: Mapped[str] = mapped_column(Text, nullable=False)
    ingredients_specifiques: Mapped[str | None] = mapped_column(Text)
    supplement_prix: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, server_default="0"
    )
    id_ligne: Mapped[int] = mapped_column(
        ForeignKey("ligne_commande.id_ligne", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    id_produit_base: Mapped[int] = mapped_column(
        ForeignKey("produit.id_produit", ondelete="RESTRICT"), nullable=False
    )

    ligne: Mapped[LigneCommande] = relationship(back_populates="personnalisation")
    produit_base: Mapped[Produit] = relationship(back_populates="personnalisations")
