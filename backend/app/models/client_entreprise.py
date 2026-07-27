"""Modèle SQLAlchemy de l'entité CLIENT_ENTREPRISE (sous-type de CLIENT)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.abonnement import Abonnement
    from app.models.client import Client


class ClientEntreprise(SoftDeleteMixin, Base):
    """Sous-type « personne morale » de CLIENT.

    Mapping 1-1 explicite : `id_client` est à la fois clé primaire et clé
    étrangère vers `client` (même choix que `ClientParticulier`).
    """

    __tablename__ = "client_entreprise"

    __table_args__ = (
        # Index unique PARTIEL, et non contrainte UNIQUE : deux lignes peuvent
        # partager cette valeur si l'une est archivee. Sans ca, une ligne
        # supprimee bloquerait sa propre valeur a jamais.
        # Le nom est conserve a l'identique : PostgreSQL le remonte dans
        # `diag.constraint_name`, dont depend la traduction des conflits en 409.
        # `sqlite_where` double `postgresql_where` — sans lui l'index serait
        # global sur SQLite et les tests vaudraient l'inverse de ce qu'ils disent.
        Index(
            "uq_client_entreprise_numero_id_fiscal",
            "numero_id_fiscal",
            unique=True,
            postgresql_where=text("supprime_le IS NULL"),
            sqlite_where=text("supprime_le IS NULL"),
        ),
    )

    id_client: Mapped[int] = mapped_column(
        ForeignKey("client.id_client", ondelete="CASCADE"), primary_key=True
    )
    raison_sociale: Mapped[str] = mapped_column(String(200), nullable=False)
    numero_id_fiscal: Mapped[str] = mapped_column(String(50), nullable=False)
    secteur_activite: Mapped[str | None] = mapped_column(String(100))
    nom_contact_referent: Mapped[str | None] = mapped_column(String(150))

    client: Mapped[Client] = relationship(back_populates="entreprise")
    abonnements: Mapped[list[Abonnement]] = relationship(
        back_populates="client_entreprise", passive_deletes=True
    )
