"""Modèle SQLAlchemy de l'entité BENEFICIAIRE."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.abonnement import Abonnement
    from app.models.consommation_repas import ConsommationRepas


class Beneficiaire(Base):
    """Personne couverte par un abonnement cantine d'entreprise.

    N'est renseigné que pour un abonnement en `mode_suivi = Individuel`.
    `statut` reste une chaîne libre : le MLD n'en fixe pas le domaine.
    """

    __tablename__ = "beneficiaire"

    id_beneficiaire: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    identifiant_badge: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )
    statut: Mapped[str] = mapped_column(String(30), nullable=False)
    id_abonnement: Mapped[int] = mapped_column(
        ForeignKey("abonnement.id_abonnement", ondelete="RESTRICT"), nullable=False
    )

    abonnement: Mapped[Abonnement] = relationship(back_populates="beneficiaires")
    # `CONSOMMATION_REPAS.id_beneficiaire` est nullable : la mise à NULL des
    # consommations à la suppression d'un bénéficiaire est un comportement
    # valide (la consommation reste imputée à l'abonnement). Pas de
    # `passive_deletes` ici, contrairement aux relations à FK NOT NULL.
    consommations: Mapped[list[ConsommationRepas]] = relationship(
        back_populates="beneficiaire"
    )
