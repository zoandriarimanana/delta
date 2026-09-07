"""Modèle SQLAlchemy de l'entité PAIEMENT."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, func, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.commande import Commande


class MethodePaiement(StrEnum):
    """Domaine de `PAIEMENT.methode` (cf. `docs/mld.md`)."""

    CARTE = "Carte"
    MOBILE_MONEY = "Mobile_money"


class FournisseurPaiement(StrEnum):
    """Domaine de `PAIEMENT.fournisseur` (cf. `docs/mld.md`).

    Liste fermée décidée en ouvrant le Sprint 9 — Mvola, Orange_money et
    Airtel_money côté mobile money, Stripe côté carte. Domaine formel et non
    chaîne libre, même raisonnement que `PERSONNEL.fonction` : une chaîne
    libre laisserait passer un identifiant de fournisseur mal orthographié
    sans rien signaler. Un fournisseur non prévu impose une migration,
    délibérément.
    """

    MVOLA = "Mvola"
    ORANGE_MONEY = "Orange_money"
    AIRTEL_MONEY = "Airtel_money"
    STRIPE = "Stripe"


class StatutPaiement(StrEnum):
    """Domaine de `PAIEMENT.statut` (cf. `docs/mld.md`).

    Trois valeurs seulement — le remboursement est **hors périmètre** du
    Sprint 9 (roadmap : intégration passerelle + webhook de confirmation,
    rien sur le remboursement). Ajouter un `Rembourse` ici mélangerait sur
    une même ligne deux cycles de vie distincts — même écueil déjà évité
    pour `SESSION_FORMATION`, qui n'a pas de statut « Complete ». Voir
    `docs/mld.md` pour la note à l'attention du sprint qui traitera le
    remboursement.
    """

    EN_ATTENTE = "En_attente"
    REUSSI = "Reussi"
    ECHOUE = "Echoue"


class Paiement(SoftDeleteMixin, Base):
    """Paiement d'une commande, initié via une passerelle carte ou mobile
    money simulée pour ce sprint (cf. `docs/mld.md`).

    Plusieurs paiements sont possibles pour une même commande — pas de
    contrainte `UNIQUE` sur `#id_commande` — pour couvrir nativement les
    tentatives échouées : aucune ligne ne représente le paiement effectif
    tant qu'elle n'est pas `Reussi`.

    **Au plus un paiement `Reussi` actif par commande**, en revanche, est
    une garantie de base : même architecture à deux niveaux que le
    chevauchement `ABONNEMENT` et les créneaux `SALLE`/`LOGEMENT`. Le
    service pré-contrôle pour produire un 409 lisible, mais c'est l'index
    ci-dessous qui tranche en cas de course entre deux paiements simultanés
    — sans lui, deux requêtes concurrentes pourraient toutes deux lire
    « aucun paiement réussi » avant que l'une n'écrive.
    """

    __tablename__ = "paiement"
    __table_args__ = (
        Index(
            "uq_paiement_commande_reussi",
            "id_commande",
            unique=True,
            postgresql_where=text("statut = 'Reussi' AND supprime_le IS NULL"),
            sqlite_where=text("statut = 'Reussi' AND supprime_le IS NULL"),
        ),
    )

    id_paiement: Mapped[int] = mapped_column(primary_key=True)
    montant: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    methode: Mapped[MethodePaiement] = mapped_column(
        SAEnum(
            MethodePaiement,
            native_enum=False,
            create_constraint=True,
            name="methode_paiement",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    fournisseur: Mapped[FournisseurPaiement] = mapped_column(
        SAEnum(
            FournisseurPaiement,
            native_enum=False,
            create_constraint=True,
            name="fournisseur_paiement",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    statut: Mapped[StatutPaiement] = mapped_column(
        SAEnum(
            StatutPaiement,
            native_enum=False,
            create_constraint=True,
            name="statut_paiement",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    #: Identifiant de transaction attribué par le fournisseur — simulé pour
    #: ce sprint. `UNIQUE` en base et non partiel, contrairement à
    #: `identifiant_badge` : une référence de transaction n'est jamais
    #: réattribuée, y compris après archivage. C'est aussi la clé de
    #: corrélation du webhook (cf. `docs/mld.md`).
    reference_externe: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )
    date_paiement: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    id_commande: Mapped[int] = mapped_column(
        ForeignKey("commande.id_commande", ondelete="RESTRICT"), nullable=False
    )

    commande: Mapped[Commande] = relationship(back_populates="paiements")
