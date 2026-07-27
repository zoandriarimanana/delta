"""Modèle SQLAlchemy de l'entité CLIENT (surtype)."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.avis import Avis
    from app.models.client_entreprise import ClientEntreprise
    from app.models.client_particulier import ClientParticulier
    from app.models.commande import Commande
    from app.models.reservation import Reservation


class TypeClient(StrEnum):
    """Discriminant des deux sous-types exclusifs de CLIENT."""

    PARTICULIER = "Particulier"
    ENTREPRISE = "Entreprise"


class Client(Base):
    """Surtype CLIENT : données communes au particulier et à l'entreprise.

    Les données propres à chaque sous-type vivent dans `client_particulier` et
    `client_entreprise`, en 1-1 explicite (leur PK est aussi la FK vers cette
    table). L'invariant « exactement une ligne fille » n'est PAS garanti en base
    à ce stade : voir la dette technique T0.7 dans `docs/roadmap.md`.
    """

    __tablename__ = "client"

    id_client: Mapped[int] = mapped_column(primary_key=True)
    type_client: Mapped[TypeClient] = mapped_column(
        # native_enum=False : stocke un VARCHAR + CHECK plutôt qu'un type ENUM
        # natif PostgreSQL, bien plus simple à faire évoluer en migration.
        # values_callable : sans lui, SQLAlchemy persiste le *nom* du membre
        # ("PARTICULIER") et non sa valeur ("Particulier") attendue par le MLD.
        SAEnum(
            TypeClient,
            native_enum=False,
            create_constraint=True,
            name="type_client",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    telephone: Mapped[str | None] = mapped_column(String(30))
    adresse: Mapped[str | None] = mapped_column(String(255))
    mot_de_passe: Mapped[str] = mapped_column(String(255), nullable=False)
    date_creation_compte: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    particulier: Mapped[ClientParticulier | None] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    entreprise: Mapped[ClientEntreprise | None] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    # `COMMANDE.id_client` est nullable : une commande dont le client est
    # supprimé bascule légitimement en commande anonyme. Pas de
    # `passive_deletes`, contrairement aux deux relations suivantes.
    commandes: Mapped[list[Commande]] = relationship(back_populates="client")
    reservations: Mapped[list[Reservation]] = relationship(
        back_populates="client", passive_deletes=True
    )
    avis: Mapped[list[Avis]] = relationship(
        back_populates="client", passive_deletes=True
    )
