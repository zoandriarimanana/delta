"""Modèle SQLAlchemy de l'entité COMMANDE."""

from __future__ import annotations

from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.ligne_commande import LigneCommande
    from app.models.livraison import Livraison
    from app.models.reservation import Reservation


class TypeCommande(StrEnum):
    """Domaine de `COMMANDE.type_commande` (cf. `docs/mld.md`)."""

    EN_LIGNE = "En_ligne"
    SUR_PLACE = "Sur_place"
    A_EMPORTER = "A_emporter"


class StatutCommande(StrEnum):
    """Domaine de `COMMANDE.statut` (cf. `docs/mld.md`)."""

    EN_ATTENTE = "En_attente"
    CONFIRMEE = "Confirmee"
    EN_PREPARATION = "En_preparation"
    LIVREE = "Livree"
    SERVIE = "Servie"
    ANNULEE = "Annulee"


#: Statut terminal selon le type de commande. Règle de **service** : elle croise
#: deux colonnes, aucun CHECK ne peut l'exprimer. Une commande sur place se
#: termine sur `Servie`, les deux autres types sur `Livree`.
STATUT_TERMINAL: dict[TypeCommande, StatutCommande] = {
    TypeCommande.SUR_PLACE: StatutCommande.SERVIE,
    TypeCommande.EN_LIGNE: StatutCommande.LIVREE,
    TypeCommande.A_EMPORTER: StatutCommande.LIVREE,
}


class Commande(SoftDeleteMixin, Base):
    """Commande de produits, passée avec ou sans compte client.

    `id_client` est NULL en mode invité : `nom_invite` et `contact_invite` sont
    alors renseignés. `id_reservation` n'est renseigné que si la commande
    découle d'une réservation de table honorée sur place (sprint 6).

    `montant_total` est **figé à la création** : il vaut la somme des lignes au
    moment où la commande est passée et n'est jamais recalculé. Une ligne
    archivée ensuite ne le modifie pas — c'est une donnée d'archive, pas une vue
    dérivée de `LIGNE_COMMANDE`.
    """

    __tablename__ = "commande"

    id_commande: Mapped[int] = mapped_column(primary_key=True)
    nom_invite: Mapped[str | None] = mapped_column(String(150))
    contact_invite: Mapped[str | None] = mapped_column(String(150))
    type_commande: Mapped[TypeCommande] = mapped_column(
        SAEnum(
            TypeCommande,
            native_enum=False,
            create_constraint=True,
            name="type_commande",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    statut: Mapped[StatutCommande] = mapped_column(
        SAEnum(
            StatutCommande,
            native_enum=False,
            create_constraint=True,
            name="statut_commande",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    montant_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default="0"
    )
    id_client: Mapped[int | None] = mapped_column(ForeignKey("client.id_client"))
    id_reservation: Mapped[int | None] = mapped_column(
        ForeignKey("reservation.id_reservation")
    )

    client: Mapped[Client | None] = relationship(back_populates="commandes")
    reservation: Mapped[Reservation | None] = relationship(back_populates="commandes")
    lignes: Mapped[list[LigneCommande]] = relationship(
        back_populates="commande", cascade="all, delete-orphan"
    )
    livraison: Mapped[Livraison | None] = relationship(
        back_populates="commande", passive_deletes=True
    )
