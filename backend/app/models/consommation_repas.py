"""Modèle SQLAlchemy de l'entité CONSOMMATION_REPAS."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.abonnement import Abonnement
    from app.models.beneficiaire import Beneficiaire


class ConsommationRepas(SoftDeleteMixin, Base):
    """Repas consommé au titre d'un abonnement cantine.

    `id_beneficiaire` est NULL lorsque l'abonnement est en
    `mode_suivi = Global` : la consommation est alors imputée à l'entreprise
    sans nominatif (cf. `docs/mld.md`).
    """

    __tablename__ = "consommation_repas"

    id_consommation: Mapped[int] = mapped_column(primary_key=True)
    date_consommation: Mapped[date] = mapped_column(Date, nullable=False)
    quantite: Mapped[int] = mapped_column(nullable=False, server_default="1")
    id_abonnement: Mapped[int] = mapped_column(
        ForeignKey("abonnement.id_abonnement", ondelete="RESTRICT"), nullable=False
    )
    id_beneficiaire: Mapped[int | None] = mapped_column(
        ForeignKey("beneficiaire.id_beneficiaire")
    )

    abonnement: Mapped[Abonnement] = relationship(back_populates="consommations")
    beneficiaire: Mapped[Beneficiaire | None] = relationship(
        back_populates="consommations"
    )
