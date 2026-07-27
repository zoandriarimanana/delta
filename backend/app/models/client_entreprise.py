"""Modèle SQLAlchemy de l'entité CLIENT_ENTREPRISE (sous-type de CLIENT)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.abonnement import Abonnement
    from app.models.client import Client


class ClientEntreprise(Base):
    """Sous-type « personne morale » de CLIENT.

    Mapping 1-1 explicite : `id_client` est à la fois clé primaire et clé
    étrangère vers `client` (même choix que `ClientParticulier`).
    """

    __tablename__ = "client_entreprise"

    id_client: Mapped[int] = mapped_column(
        ForeignKey("client.id_client", ondelete="CASCADE"), primary_key=True
    )
    raison_sociale: Mapped[str] = mapped_column(String(200), nullable=False)
    numero_id_fiscal: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )
    secteur_activite: Mapped[str | None] = mapped_column(String(100))
    nom_contact_referent: Mapped[str | None] = mapped_column(String(150))

    client: Mapped[Client] = relationship(back_populates="entreprise")
    abonnements: Mapped[list[Abonnement]] = relationship(
        back_populates="client_entreprise", passive_deletes=True
    )
