"""Modèle SQLAlchemy de DEMANDE_FORMATION (14 octobre 2026).

Une **formation sur commande** : un visiteur demande une formation qui n'est
pas au catalogue (« Vous ne trouvez pas votre formation ? »). Retour du client
après la présentation de la plateforme. L'administration la suit jusqu'à la
planifier — en créant une formation ou une session au catalogue — ou la
refuser (voir `docs/mld.md`).
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.client import Client


class StatutDemandeFormation(StrEnum):
    """Où en est la demande. Posé par l'administration seule ; une demande
    naît toujours `Nouvelle`."""

    NOUVELLE = "Nouvelle"
    EN_DISCUSSION = "En_discussion"
    PLANIFIEE = "Planifiee"
    REFUSEE = "Refusee"


class LieuFormation(StrEnum):
    """Où le demandeur souhaite être formé."""

    CHEZ_DELTA = "Chez_delta"
    EN_ENTREPRISE = "En_entreprise"
    INDIFFERENT = "Indifferent"


def _enum(classe: type[StrEnum], nom: str) -> SAEnum:
    return SAEnum(
        classe,
        native_enum=False,
        create_constraint=True,
        name=nom,
        values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
    )


class DemandeFormation(SoftDeleteMixin, Base):
    """Demande de formation sur mesure, envoyée avec ou sans compte."""

    __tablename__ = "demande_formation"
    __table_args__ = (
        CheckConstraint("nombre_participants >= 1", name="participants_positif"),
    )

    id_demande: Mapped[int] = mapped_column(primary_key=True)
    sujet: Mapped[str] = mapped_column(String(200), nullable=False)
    nombre_participants: Mapped[int] = mapped_column(nullable=False)
    #: Niveau des participants, en clair (« Débutant », « Professionnel »…).
    niveau: Mapped[str | None] = mapped_column(String(100))
    #: Période souhaitée, en clair : une demande ne connaît pas encore de dates.
    periode_souhaitee: Mapped[str | None] = mapped_column(String(200))
    lieu: Mapped[LieuFormation] = mapped_column(
        _enum(LieuFormation, "lieu_formation"),
        nullable=False,
        server_default=LieuFormation.INDIFFERENT.value,
    )
    message: Mapped[str | None] = mapped_column(Text)
    #: Qui rappeler — exigés même pour un client connecté : il peut vouloir
    #: être joint ailleurs qu'à l'adresse de son compte.
    nom_contact: Mapped[str] = mapped_column(String(150), nullable=False)
    contact: Mapped[str] = mapped_column(String(150), nullable=False)
    statut: Mapped[StatutDemandeFormation] = mapped_column(
        _enum(StatutDemandeFormation, "statut_demande_formation"),
        nullable=False,
        server_default=StatutDemandeFormation.NOUVELLE.value,
    )
    #: Suivi interne de l'administration, jamais montré au demandeur.
    note_interne: Mapped[str | None] = mapped_column(Text)
    date_demande: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    #: Client connecté au moment de la demande, **déduit de la session** et
    #: jamais du corps ; `NULL` pour une demande sans compte.
    id_client: Mapped[int | None] = mapped_column(
        ForeignKey("client.id_client", ondelete="RESTRICT")
    )

    client: Mapped[Client | None] = relationship()
