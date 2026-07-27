"""Modèle SQLAlchemy de l'entité BENEFICIAIRE."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.abonnement import Abonnement
    from app.models.consommation_repas import ConsommationRepas


class Beneficiaire(SoftDeleteMixin, Base):
    """Personne couverte par un abonnement cantine d'entreprise.

    N'est renseigné que pour un abonnement en `mode_suivi = Individuel`.
    `statut` reste une chaîne libre : le MLD n'en fixe pas le domaine.
    """

    __tablename__ = "beneficiaire"

    __table_args__ = (
        # Index unique PARTIEL, et non contrainte UNIQUE : deux lignes peuvent
        # partager cette valeur si l'une est archivee. Sans ca, une ligne
        # supprimee bloquerait sa propre valeur a jamais.
        # Le nom est conserve a l'identique : PostgreSQL le remonte dans
        # `diag.constraint_name`, dont depend la traduction des conflits en 409.
        # `sqlite_where` double `postgresql_where` — sans lui l'index serait
        # global sur SQLite et les tests vaudraient l'inverse de ce qu'ils disent.
        Index(
            "uq_beneficiaire_identifiant_badge",
            "identifiant_badge",
            unique=True,
            postgresql_where=text("supprime_le IS NULL"),
            sqlite_where=text("supprime_le IS NULL"),
        ),
    )

    id_beneficiaire: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    identifiant_badge: Mapped[str] = mapped_column(String(50), nullable=False)
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
