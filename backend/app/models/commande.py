"""Modèle SQLAlchemy de l'entité COMMANDE."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.ligne_commande import LigneCommande
    from app.models.livraison import Livraison
    from app.models.personnel import Personnel
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
    __table_args__ = (
        # Contrainte n°5 du MLD : client identifié XOR invité. Elle n'est pas
        # reportée en applicatif comme celle de CLIENT (T0.7) — l'insertion se
        # fait en un seul temps, il n'y a aucun état transitoire à tolérer.
        CheckConstraint(
            "(id_client IS NOT NULL) <> (nom_invite IS NOT NULL)",
            name="client_ou_invite",
        ),
    )

    id_commande: Mapped[int] = mapped_column(primary_key=True)
    #: Horodatage de passation, posé par la base (`now()`) et non par
    #: l'application : c'est l'horloge du serveur qui fait foi, pas celle du
    #: processus Python qui a traité la requête.
    #:
    #: `TIMESTAMPTZ` et non `TIMESTAMP` : une commande est un fait daté, et la
    #: même colonne servira aux commandes prises sur place comme en ligne. Sans
    #: fuseau, deux serveurs configurés différemment produiraient des instants
    #: incomparables.
    #:
    #: `NOT NULL` sans valeur par défaut applicative : une commande sans date
    #: n'a pas de sens, et le `server_default` garantit que même une insertion
    #: hors API — script de seed, correction manuelle — en porte une.
    date_commande: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    #: UUID généré **uniquement** en mode invité, NULL sinon. Seul moyen pour un
    #: invité de revenir sur sa commande : il n'a ni compte ni jeton. Un UUID et
    #: non l'identifiant séquentiel, qui serait énumérable.
    #:
    #: `UNIQUE` globale et non index partiel : un UUID n'est jamais réattribué,
    #: il n'y a donc aucune valeur à libérer à l'archivage. SQL considère par
    #: ailleurs les NULL comme distincts, les commandes connectées ne se gênent
    #: donc pas entre elles.
    reference_publique: Mapped[UUID | None] = mapped_column(
        Uuid(), unique=True, default=None
    )
    #: Adresse saisie au tunnel, pour tout client — invité comme connecté.
    #: Elle ne se déduit **pas** de `CLIENT.adresse`, qui est l'adresse de
    #: profil : on se fait livrer au bureau, chez un tiers, ailleurs qu'à son
    #: domicile. Et un invité n'en a aucune.
    #:
    #: `NULL` signifie « pas de livraison demandée » : c'est sa présence qui
    #: déclenche la création de la `LIVRAISON`.
    adresse_livraison: Mapped[str | None] = mapped_column(Text)
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
    #: Salarié qui a saisi la commande, `NULL` si le client l'a passée lui-même.
    #:
    #: `NULL` a un sens précis et unique : **la commande vient du parcours
    #: client**. C'est le cas de toutes les commandes antérieures, et il reste le
    #: cas courant. Une valeur ne peut venir que de `POST /commandes/personnel`.
    #:
    #: L'identifiant est **dérivé du jeton**, jamais transmis dans le corps —
    #: même règle que `id_client`, et pour la même raison : une identité qui
    #: vient de la requête est une identité qu'on peut usurper. Le laisser saisir
    #: permettrait d'attribuer une commande à un collègue.
    #:
    #: `ON DELETE RESTRICT` : un salarié ne s'efface pas, il s'anonymise — la
    #: commande garde alors un identifiant devenu anonyme, comme les livraisons
    #: et les sessions de formation.
    id_personnel: Mapped[int | None] = mapped_column(
        ForeignKey("personnel.id_personnel", ondelete="RESTRICT")
    )

    client: Mapped[Client | None] = relationship(back_populates="commandes")
    reservation: Mapped[Reservation | None] = relationship(back_populates="commandes")
    personnel: Mapped[Personnel | None] = relationship(back_populates="commandes")
    lignes: Mapped[list[LigneCommande]] = relationship(
        back_populates="commande", cascade="all, delete-orphan"
    )
    livraison: Mapped[Livraison | None] = relationship(
        back_populates="commande", passive_deletes=True
    )
