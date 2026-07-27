"""Modèle SQLAlchemy de l'entité PERSONNEL."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.livraison import Livraison
    from app.models.session_formation import SessionFormation


class Personnel(SoftDeleteMixin, Base):
    """Membre du personnel, toutes fonctions confondues.

    `fonction` reste une chaîne libre : le MLD n'en fixe pas le domaine. Les
    valeurs attendues côté métier sont Formateur, Livreur, Cuisinier et
    Réceptionniste (cf. `docs/roadmap.md`, sprint 3). `specialite` n'a de sens
    que pour un formateur, `zone_livraison` que pour un livreur : les deux sont
    donc nullables.
    """

    __tablename__ = "personnel"

    __table_args__ = (
        # Index unique PARTIEL, et non contrainte UNIQUE : deux lignes peuvent
        # partager cette valeur si l'une est archivee. Sans ca, une ligne
        # supprimee bloquerait sa propre valeur a jamais.
        # Le nom est conserve a l'identique : PostgreSQL le remonte dans
        # `diag.constraint_name`, dont depend la traduction des conflits en 409.
        # `sqlite_where` double `postgresql_where` — sans lui l'index serait
        # global sur SQLite et les tests vaudraient l'inverse de ce qu'ils disent.
        Index(
            "uq_personnel_email",
            "email",
            unique=True,
            postgresql_where=text("supprime_le IS NULL"),
            sqlite_where=text("supprime_le IS NULL"),
        ),
    )

    id_personnel: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    fonction: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    telephone: Mapped[str | None] = mapped_column(String(30))
    date_embauche: Mapped[date | None] = mapped_column(Date)
    specialite: Mapped[str | None] = mapped_column(String(100))
    zone_livraison: Mapped[str | None] = mapped_column(String(100))

    sessions_formation: Mapped[list[SessionFormation]] = relationship(
        back_populates="formateur"
    )
    livraisons: Mapped[list[Livraison]] = relationship(back_populates="livreur")
