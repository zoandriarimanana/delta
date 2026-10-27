"""Modèle SQLAlchemy de l'entité CLIENT_PARTICULIER (sous-type de CLIENT)."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.client import Client


class ClientParticulier(SoftDeleteMixin, Base):
    """Sous-type « personne physique » de CLIENT.

    Mapping 1-1 explicite : `id_client` est à la fois la clé primaire de cette
    table et la clé étrangère vers `client`. Choix délibéré contre le
    polymorphisme natif SQLAlchemy (`polymorphic_identity`), plus lisible pour
    l'équipe et plus proche du MLD.
    """

    __tablename__ = "client_particulier"

    id_client: Mapped[int] = mapped_column(
        ForeignKey("client.id_client", ondelete="CASCADE"), primary_key=True
    )
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    date_naissance: Mapped[date | None] = mapped_column(Date)

    client: Mapped[Client] = relationship(back_populates="particulier")
