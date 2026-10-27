"""Modèle SQLAlchemy de l'entité SESSION_FORMATION."""

from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.formation import Formation
    from app.models.personnel import Personnel
    from app.models.reservation import Reservation


class StatutSessionFormation(StrEnum):
    """Domaine de `SESSION_FORMATION.statut` (cf. `docs/mld.md`).

    Domaine formel et non chaîne libre, même traitement que `COMMANDE.statut`,
    `LIVRAISON.statut` et `PERSONNEL.fonction` : le service compare ces valeurs
    pour décider ce qu'une session autorise encore — une réservation ne se prend
    que sur une session `Ouverte` (sprint 4, réservations).

    **Il n'y a pas de statut « Complete », délibérément.** Une session pleine se
    lit sur `places_restantes = 0`, et l'inscrire aussi dans le statut créerait
    deux sources pour un même fait, qui divergeraient à la première annulation
    de réservation. Chaque valeur ci-dessous désigne un état du cycle de vie que
    nulle autre colonne ne porte.
    """

    PLANIFIEE = "Planifiee"
    OUVERTE = "Ouverte"
    TERMINEE = "Terminee"
    ANNULEE = "Annulee"


class SessionFormation(SoftDeleteMixin, Base):
    """Occurrence datée d'une FORMATION, animée par un formateur.

    `id_formateur` est nullable : une session est planifiée avant qu'un
    formateur ne lui soit affecté, et `NULL` signifie « pas encore affecté ».
    La contrainte « le personnel référencé a la fonction Formateur » n'est
    **pas** exprimable en clé étrangère — celle-ci pointe vers `PERSONNEL` tout
    entier — et relève de `PersonnelService.obtenir_avec_fonction`, partagé avec
    `LIVRAISON`.

    `places_restantes` est initialisé depuis `FORMATION.capacite_max` par le
    serveur, jamais reçu de la requête : l'accepter laisserait ouvrir une
    session à mille places sur une formation qui en compte douze.
    """

    __tablename__ = "session_formation"

    id_session: Mapped[int] = mapped_column(primary_key=True)
    date_debut: Mapped[date] = mapped_column(Date, nullable=False)
    date_fin: Mapped[date] = mapped_column(Date, nullable=False)
    places_restantes: Mapped[int] = mapped_column(nullable=False)
    statut: Mapped[StatutSessionFormation] = mapped_column(
        SAEnum(
            StatutSessionFormation,
            native_enum=False,
            create_constraint=True,
            name="statut_session_formation",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    id_formation: Mapped[int] = mapped_column(
        ForeignKey("formation.id_formation", ondelete="RESTRICT"), nullable=False
    )
    id_formateur: Mapped[int | None] = mapped_column(
        ForeignKey("personnel.id_personnel")
    )

    formation: Mapped[Formation] = relationship(back_populates="sessions")
    formateur: Mapped[Personnel | None] = relationship(
        back_populates="sessions_formation"
    )
    reservations: Mapped[list[Reservation]] = relationship(back_populates="session")
