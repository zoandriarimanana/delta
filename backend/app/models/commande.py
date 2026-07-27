"""Modèle SQLAlchemy de l'entité COMMANDE."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.ligne_commande import LigneCommande
    from app.models.livraison import Livraison
    from app.models.reservation import Reservation


class Commande(SoftDeleteMixin, Base):
    """Commande de produits, passée avec ou sans compte client.

    `id_client` est NULL en mode invité : `nom_invite` et `contact_invite` sont
    alors renseignés. `id_reservation` n'est renseigné que si la commande
    découle d'une réservation de table honorée sur place (sprint 6).

    `type_commande` et `statut` restent des chaînes libres : le MLD n'en fixe
    pas le domaine.
    """

    __tablename__ = "commande"

    id_commande: Mapped[int] = mapped_column(primary_key=True)
    nom_invite: Mapped[str | None] = mapped_column(String(150))
    contact_invite: Mapped[str | None] = mapped_column(String(150))
    type_commande: Mapped[str] = mapped_column(String(30), nullable=False)
    statut: Mapped[str] = mapped_column(String(30), nullable=False)
    montant_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default="0"
    )
    id_client: Mapped[int | None] = mapped_column(ForeignKey("client.id_client"))
    id_reservation: Mapped[int | None] = mapped_column(
        ForeignKey("reservation.id_reservation")
    )

    client: Mapped[Client | None] = relationship(back_populates="commandes")
    reservation: Mapped[Reservation | None] = relationship(back_populates="commandes")
    lignes: Mapped[list[LigneCommande]] = relationship(
        back_populates="commande", cascade="all, delete-orphan"
    )
    livraison: Mapped[Livraison | None] = relationship(
        back_populates="commande", passive_deletes=True
    )
