"""Modèle SQLAlchemy de l'entité SALLE."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.reservation import Reservation


class Salle(SoftDeleteMixin, Base):
    """Salle louable, tarifée à l'heure et/ou à la journée.

    Les deux tarifs sont nullables **individuellement**, mais pas ensemble : une
    salle en porte toujours au moins un. Voir le `CHECK` ci-dessous.
    """

    __tablename__ = "salle"

    __table_args__ = (
        # Règle du dictionnaire de données d'origine, jamais portée en
        # contrainte jusqu'ici — même cas que l'unicité de `CLIENT.email` et les
        # bornes d'`AVIS.note`. Ce n'est pas une règle nouvelle.
        #
        # Sans elle, une salle dépourvue des deux tarifs serait louable
        # gratuitement sans que personne l'ait décidé, et rien ne distinguerait
        # « gratuit » de « tarif oublié à la saisie ». Avec elle, la gratuité
        # doit s'écrire `0.00` : c'est une décision, plus une absence.
        #
        # Une disjonction et non un `NOT NULL` sur les deux : une salle louée à
        # l'heure seulement, ou à la journée seulement, est le cas courant.
        CheckConstraint(
            "tarif_horaire IS NOT NULL OR tarif_journee IS NOT NULL",
            name="au_moins_un_tarif",
        ),
    )

    id_salle: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    capacite: Mapped[int] = mapped_column(nullable=False)
    tarif_horaire: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    tarif_journee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    equipements: Mapped[str | None] = mapped_column(Text)

    reservations: Mapped[list[Reservation]] = relationship(back_populates="salle")
