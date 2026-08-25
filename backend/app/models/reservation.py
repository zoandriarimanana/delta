"""Modèle SQLAlchemy de l'entité RESERVATION."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, literal_column, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.avis import Avis
    from app.models.client import Client
    from app.models.commande import Commande
    from app.models.logement import Logement
    from app.models.salle import Salle
    from app.models.session_formation import SessionFormation


class TypeReservation(StrEnum):
    """Domaine de `RESERVATION.type_reservation` (cf. `docs/mld.md`)."""

    FORMATION = "Formation"
    SALLE = "Salle"
    LOGEMENT = "Logement"
    TABLE = "Table"


class StatutReservation(StrEnum):
    """Domaine de `RESERVATION.statut` (cf. `docs/mld.md`).

    Domaine formel et non chaîne libre, même traitement que `COMMANDE.statut`,
    `LIVRAISON.statut` et `SESSION_FORMATION.statut` : le service compare ces
    valeurs pour décider si une place doit être restituée.

    `HONOREE` et `ANNULEE` sont les deux fins possibles, et elles ne sont pas
    interchangeables — l'une dit que la prestation a eu lieu, l'autre qu'elle
    n'aura pas lieu. **Seule `ANNULEE` restitue la place** : un stagiaire venu
    a bien consommé la sienne. Les confondre ferait réapparaître des places
    déjà utilisées.

    Le terme « honorée » est celui du MLD, qui parle de « réservation honorée »
    comme preuve de transaction (section sur la suppression logique).
    """

    EN_ATTENTE = "En_attente"
    CONFIRMEE = "Confirmee"
    HONOREE = "Honoree"
    ANNULEE = "Annulee"


#: Statuts qui n'immobilisent plus le bien. Une réservation annulée libère son
#: créneau ; une réservation archivée n'existe plus pour les lectures courantes.
#: Le prédicat des contraintes d'exclusion les écarte, sans quoi une annulation
#: bloquerait le créneau à jamais — même raisonnement que la restitution des
#: places en #41.
_PREDICAT_OCCUPANT = "supprime_le IS NULL AND statut <> 'Annulee'"


def _exclusion(colonne: str, nom: str) -> ExcludeConstraint:
    """Contrainte d'exclusion interdisant deux réservations qui se recoupent.

    `tstzrange(date_debut, date_fin)` a des bornes `[)` par défaut : le début est
    inclus, la fin exclue. Deux créneaux **adjacents** — l'un finissant quand
    l'autre commence — ne se chevauchent donc pas, ce qui est le comportement
    attendu pour une salle libérée à l'heure pile.

    `USING gist` avec l'opérateur `=` sur un entier exige l'extension
    `btree_gist` : GiST ne sait pas comparer des entiers pour l'égalité sans
    elle. La migration la crée.

    C'est **la** garantie contre le double usage d'un bien. Une vérification
    applicative seule laisserait passer deux requêtes simultanées : il n'y a ici
    aucun compteur sur lequel poser un verrou de ligne, contrairement à
    `places_restantes` ou `stock_disponible`. La base est le seul arbitre
    possible.
    """
    return ExcludeConstraint(
        (colonne, "="),
        (literal_column("tstzrange(date_debut, date_fin)"), "&&"),
        name=nom,
        using="gist",
        where=text(f"{colonne} IS NOT NULL AND {_PREDICAT_OCCUPANT}"),
    )


class Reservation(SoftDeleteMixin, Base):
    """Réservation d'une session de formation, d'une salle, d'un logement ou
    d'une table.

    Les trois cibles possibles sont portées par trois FK nullables dont une
    seule au plus peut être renseignée (aucune si `type_reservation = Table`) :
    contrainte n°2 du MLD, implémentée ici en `CheckConstraint`.

    `id_client` est NOT NULL : un compte est obligatoire pour réserver,
    contrairement à COMMANDE qui autorise l'invité. Voir « Hypothèse de travail
    à surveiller » dans `docs/mld.md` si cette règle métier change.
    """

    __tablename__ = "reservation"
    __table_args__ = (
        CheckConstraint(
            "(id_session IS NOT NULL)::int"
            " + (id_salle IS NOT NULL)::int"
            " + (id_logement IS NOT NULL)::int <= 1",
            name="cible_unique",
        ),
        _exclusion("id_salle", "salle_sans_chevauchement"),
        _exclusion("id_logement", "logement_sans_chevauchement"),
    )

    id_reservation: Mapped[int] = mapped_column(primary_key=True)
    type_reservation: Mapped[TypeReservation] = mapped_column(
        SAEnum(
            TypeReservation,
            native_enum=False,
            create_constraint=True,
            name="type_reservation",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    date_debut: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    date_fin: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    nombre_personnes: Mapped[int] = mapped_column(nullable=False, server_default="1")
    statut: Mapped[StatutReservation] = mapped_column(
        SAEnum(
            StatutReservation,
            native_enum=False,
            create_constraint=True,
            name="statut_reservation",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    avec_hebergement: Mapped[bool] = mapped_column(
        nullable=False, server_default="false"
    )
    id_client: Mapped[int] = mapped_column(
        ForeignKey("client.id_client", ondelete="RESTRICT"), nullable=False
    )
    id_session: Mapped[int | None] = mapped_column(
        ForeignKey("session_formation.id_session")
    )
    id_salle: Mapped[int | None] = mapped_column(ForeignKey("salle.id_salle"))
    id_logement: Mapped[int | None] = mapped_column(ForeignKey("logement.id_logement"))

    client: Mapped[Client] = relationship(back_populates="reservations")
    session: Mapped[SessionFormation | None] = relationship(
        back_populates="reservations"
    )
    salle: Mapped[Salle | None] = relationship(back_populates="reservations")
    logement: Mapped[Logement | None] = relationship(back_populates="reservations")
    commandes: Mapped[list[Commande]] = relationship(back_populates="reservation")
    avis: Mapped[list[Avis]] = relationship(back_populates="reservation")
