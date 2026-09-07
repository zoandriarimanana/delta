"""Modèle SQLAlchemy de l'entité AVIS."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.ligne_commande import LigneCommande
    from app.models.reservation import Reservation


class TypeAvis(StrEnum):
    """Domaine de `AVIS.type_avis` (cf. `docs/mld.md`)."""

    PRODUIT = "Produit"
    SERVICE = "Service"


class Avis(SoftDeleteMixin, Base):
    """Avis client portant soit sur une ligne de commande, soit sur une
    réservation.

    Exactement une des deux cibles est renseignée : contrainte n°3 du MLD,
    implémentée ici en `CheckConstraint` (XOR strict, contrairement à
    RESERVATION où aucune cible n'est un cas valide).

    `type_avis` est cohérent avec la cible renseignée (`Produit ⟺ #id_ligne`,
    `Service ⟺ #id_reservation`) — décidé en construisant le Sprint 8, voir
    `docs/mld.md`. Un seul avis par client et par cible : les deux index
    uniques partiels ci-dessous, permettant qu'un avis retiré pour modération
    soit remplacé par un nouveau.
    """

    __tablename__ = "avis"
    __table_args__ = (
        CheckConstraint(
            "(id_ligne IS NOT NULL) <> (id_reservation IS NOT NULL)",
            name="cible_xor",
        ),
        CheckConstraint("note BETWEEN 1 AND 5", name="note_intervalle"),
        # Ne croise aucune autre table : type_avis, id_ligne et id_reservation
        # vivent tous sur AVIS. Combinee a cible_xor, cette seule equivalence
        # suffit a garantir les deux sens (cf. docs/mld.md).
        CheckConstraint(
            "(type_avis = 'Produit') = (id_ligne IS NOT NULL)",
            name="type_coherent_avec_cible",
        ),
        # Index uniques PARTIELS, et non contraintes UNIQUE : un avis retire
        # pour moderation (archive) doit pouvoir etre remplace par un nouveau,
        # contrairement a LIVRAISON.#id_commande qui n'est jamais reattribuee.
        # Meme raisonnement que uq_beneficiaire_identifiant_badge en 7.1.2.
        Index(
            "uq_avis_client_ligne",
            "id_client",
            "id_ligne",
            unique=True,
            postgresql_where=text("supprime_le IS NULL AND id_ligne IS NOT NULL"),
            sqlite_where=text("supprime_le IS NULL AND id_ligne IS NOT NULL"),
        ),
        Index(
            "uq_avis_client_reservation",
            "id_client",
            "id_reservation",
            unique=True,
            postgresql_where=text("supprime_le IS NULL AND id_reservation IS NOT NULL"),
            sqlite_where=text("supprime_le IS NULL AND id_reservation IS NOT NULL"),
        ),
    )

    id_avis: Mapped[int] = mapped_column(primary_key=True)
    type_avis: Mapped[TypeAvis] = mapped_column(
        SAEnum(
            TypeAvis,
            native_enum=False,
            create_constraint=True,
            name="type_avis",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    note: Mapped[int] = mapped_column(nullable=False)
    commentaire: Mapped[str | None] = mapped_column(Text)
    date_avis: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    id_client: Mapped[int] = mapped_column(
        ForeignKey("client.id_client", ondelete="RESTRICT"), nullable=False
    )
    id_ligne: Mapped[int | None] = mapped_column(ForeignKey("ligne_commande.id_ligne"))
    id_reservation: Mapped[int | None] = mapped_column(
        ForeignKey("reservation.id_reservation")
    )

    client: Mapped[Client] = relationship(back_populates="avis")
    ligne: Mapped[LigneCommande | None] = relationship(back_populates="avis")
    reservation: Mapped[Reservation | None] = relationship(back_populates="avis")
