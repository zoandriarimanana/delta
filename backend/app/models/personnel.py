"""Modèle SQLAlchemy de l'entité PERSONNEL."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.livraison import Livraison
    from app.models.session_formation import SessionFormation


class Personnel(Base):
    """Membre du personnel, toutes fonctions confondues.

    `fonction` reste une chaîne libre : le MLD n'en fixe pas le domaine. Les
    valeurs attendues côté métier sont Formateur, Livreur, Cuisinier et
    Réceptionniste (cf. `docs/roadmap.md`, sprint 3). `specialite` n'a de sens
    que pour un formateur, `zone_livraison` que pour un livreur : les deux sont
    donc nullables.
    """

    __tablename__ = "personnel"

    id_personnel: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    fonction: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    telephone: Mapped[str | None] = mapped_column(String(30))
    date_embauche: Mapped[date | None] = mapped_column(Date)
    specialite: Mapped[str | None] = mapped_column(String(100))
    zone_livraison: Mapped[str | None] = mapped_column(String(100))

    sessions_formation: Mapped[list[SessionFormation]] = relationship(
        back_populates="formateur"
    )
    livraisons: Mapped[list[Livraison]] = relationship(back_populates="livreur")
