"""Modèle SQLAlchemy de l'entité LIGNE_COMMANDE."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.avis import Avis
    from app.models.commande import Commande
    from app.models.demande_personnalisation import DemandePersonnalisation
    from app.models.produit import Produit


class LigneCommande(SoftDeleteMixin, Base):
    """Ligne d'une commande : un produit, une quantité, un prix figé.

    `prix_unitaire_applique` recopie le prix du produit au moment de la
    commande : il ne doit pas suivre les évolutions ultérieures de
    `PRODUIT.prix_unitaire`.
    """

    __tablename__ = "ligne_commande"

    id_ligne: Mapped[int] = mapped_column(primary_key=True)
    quantite: Mapped[int] = mapped_column(nullable=False)
    prix_unitaire_applique: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    id_commande: Mapped[int] = mapped_column(
        ForeignKey("commande.id_commande", ondelete="CASCADE"), nullable=False
    )
    id_produit: Mapped[int] = mapped_column(
        ForeignKey("produit.id_produit", ondelete="RESTRICT"), nullable=False
    )

    commande: Mapped[Commande] = relationship(back_populates="lignes")
    produit: Mapped[Produit] = relationship(back_populates="lignes_commande")
    personnalisation: Mapped[DemandePersonnalisation | None] = relationship(
        back_populates="ligne", cascade="all, delete-orphan"
    )
    avis: Mapped[list[Avis]] = relationship(back_populates="ligne")
