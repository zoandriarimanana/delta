"""Modèle SQLAlchemy de l'entité AVIS."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.ligne_commande import LigneCommande
    from app.models.reservation import Reservation


class TypeAvis(StrEnum):
    """Domaine de `AVIS.type_avis` (cf. `docs/mld.md`)."""

    PRODUIT = "Produit"
    SERVICE = "Service"


class Avis(Base):
    """Avis client portant soit sur une ligne de commande, soit sur une
    réservation.

    Exactement une des deux cibles est renseignée : contrainte n°3 du MLD,
    implémentée ici en `CheckConstraint` (XOR strict, contrairement à
    RESERVATION où aucune cible n'est un cas valide).
    """

    __tablename__ = "avis"
    __table_args__ = (
        CheckConstraint(
            "(id_ligne IS NOT NULL) <> (id_reservation IS NOT NULL)",
            name="cible_xor",
        ),
        CheckConstraint("note BETWEEN 1 AND 5", name="note_intervalle"),
    )

    id_avis: Mapped[int] = mapped_column(primary_key=True)
    type_avis: Mapped[TypeAvis] = mapped_column(
        SAEnum(
            TypeAvis,
            native_enum=False,
            create_constraint=True,
            name="type_avis",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    note: Mapped[int] = mapped_column(nullable=False)
    commentaire: Mapped[str | None] = mapped_column(Text)
    date_avis: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    id_client: Mapped[int] = mapped_column(
        ForeignKey("client.id_client", ondelete="RESTRICT"), nullable=False
    )
    id_ligne: Mapped[int | None] = mapped_column(ForeignKey("ligne_commande.id_ligne"))
    id_reservation: Mapped[int | None] = mapped_column(
        ForeignKey("reservation.id_reservation")
    )

    client: Mapped[Client] = relationship(back_populates="avis")
    ligne: Mapped[LigneCommande | None] = relationship(back_populates="avis")
    reservation: Mapped[Reservation | None] = relationship(back_populates="avis")
