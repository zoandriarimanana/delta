"""Modèle SQLAlchemy de l'entité RESERVATION."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.avis import Avis
    from app.models.client import Client
    from app.models.commande import Commande
    from app.models.logement import Logement
    from app.models.salle import Salle
    from app.models.session_formation import SessionFormation


class TypeReservation(StrEnum):
    """Domaine de `RESERVATION.type_reservation` (cf. `docs/mld.md`)."""

    FORMATION = "Formation"
    SALLE = "Salle"
    LOGEMENT = "Logement"
    TABLE = "Table"


class Reservation(SoftDeleteMixin, Base):
    """Réservation d'une session de formation, d'une salle, d'un logement ou
    d'une table.

    Les trois cibles possibles sont portées par trois FK nullables dont une
    seule au plus peut être renseignée (aucune si `type_reservation = Table`) :
    contrainte n°2 du MLD, implémentée ici en `CheckConstraint`.

    `id_client` est NOT NULL : un compte est obligatoire pour réserver,
    contrairement à COMMANDE qui autorise l'invité. Voir « Hypothèse de travail
    à surveiller » dans `docs/mld.md` si cette règle métier change.
    """

    __tablename__ = "reservation"
    __table_args__ = (
        CheckConstraint(
            "(id_session IS NOT NULL)::int"
            " + (id_salle IS NOT NULL)::int"
            " + (id_logement IS NOT NULL)::int <= 1",
            name="cible_unique",
        ),
    )

    id_reservation: Mapped[int] = mapped_column(primary_key=True)
    type_reservation: Mapped[TypeReservation] = mapped_column(
        SAEnum(
            TypeReservation,
            native_enum=False,
            create_constraint=True,
            name="type_reservation",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    date_debut: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    date_fin: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    nombre_personnes: Mapped[int] = mapped_column(nullable=False, server_default="1")
    statut: Mapped[str] = mapped_column(String(30), nullable=False)
    avec_hebergement: Mapped[bool] = mapped_column(
        nullable=False, server_default="false"
    )
    id_client: Mapped[int] = mapped_column(
        ForeignKey("client.id_client", ondelete="RESTRICT"), nullable=False
    )
    id_session: Mapped[int | None] = mapped_column(
        ForeignKey("session_formation.id_session")
    )
    id_salle: Mapped[int | None] = mapped_column(ForeignKey("salle.id_salle"))
    id_logement: Mapped[int | None] = mapped_column(ForeignKey("logement.id_logement"))

    client: Mapped[Client] = relationship(back_populates="reservations")
    session: Mapped[SessionFormation | None] = relationship(
        back_populates="reservations"
    )
    salle: Mapped[Salle | None] = relationship(back_populates="reservations")
    logement: Mapped[Logement | None] = relationship(back_populates="reservations")
    commandes: Mapped[list[Commande]] = relationship(back_populates="reservation")
    avis: Mapped[list[Avis]] = relationship(back_populates="reservation")
