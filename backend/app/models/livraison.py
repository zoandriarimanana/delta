"""Modèle SQLAlchemy de l'entité LIVRAISON."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.commande import Commande
    from app.models.personnel import Personnel


class Livraison(Base):
    """Livraison d'une commande par un membre du personnel.

    `id_personnel` est nullable : la livraison est créée dès que la commande
    est livrable, l'affectation du livreur pouvant intervenir plus tard
    (sprint 3). La contrainte « le personnel référencé a la fonction Livreur »
    n'est pas exprimable en clé étrangère et relève de la couche `services/`.

    `date_heure_reelle` reste NULL tant que la livraison n'est pas effectuée.
    """

    __tablename__ = "livraison"

    id_livraison: Mapped[int] = mapped_column(primary_key=True)
    adresse_livraison: Mapped[str] = mapped_column(Text, nullable=False)
    date_heure_prevue: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    date_heure_reelle: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    statut: Mapped[str] = mapped_column(String(30), nullable=False)
    id_commande: Mapped[int] = mapped_column(
        ForeignKey("commande.id_commande", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
    )
    id_personnel: Mapped[int | None] = mapped_column(
        ForeignKey("personnel.id_personnel")
    )

    commande: Mapped[Commande] = relationship(back_populates="livraison")
    livreur: Mapped[Personnel | None] = relationship(back_populates="livraisons")
