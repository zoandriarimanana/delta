"""Modèle SQLAlchemy de l'entité ABONNEMENT (cantine B2B)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.beneficiaire import Beneficiaire
    from app.models.client_entreprise import ClientEntreprise
    from app.models.consommation_repas import ConsommationRepas


class TypeFacturation(StrEnum):
    """Domaine de `ABONNEMENT.type_facturation` (cf. `docs/mld.md`)."""

    FORFAIT = "Forfait"
    CONSOMMATION_REELLE = "Consommation_reelle"


class ModeSuivi(StrEnum):
    """Domaine de `ABONNEMENT.mode_suivi` (cf. `docs/mld.md`)."""

    INDIVIDUEL = "Individuel"
    GLOBAL = "Global"


class Abonnement(SoftDeleteMixin, Base):
    """Abonnement cantine souscrit par une entreprise cliente.

    `date_fin` est obligatoire : un abonnement B2B a une échéance contractuelle,
    contrairement à `RESERVATION` dont certains types n'ont pas de borne fixée
    a priori.

    Les tarifs sont mutuellement mais gardés nullables **individuellement** :
    `tarif_forfait` vaut pour `type_facturation = Forfait`,
    `tarif_unitaire_repas` pour `Consommation_reelle`. Le `CHECK` garantit que
    le tarif correspondant au type choisi est renseigné — même pattern que
    `PRODUIT.supplement_personnalisation` (cf. `docs/mld.md`).
    """

    __tablename__ = "abonnement"

    __table_args__ = (
        # Noms "nus" : la convention de nommage de core/database.py ajoute le
        # prefixe ck_abonnement_ automatiquement. Un nom deja prefixe ici
        # produirait un double prefixe (bug attrape sur salle en 22127cdc2dce).
        CheckConstraint("date_fin > date_debut", name="dates_coherentes"),
        CheckConstraint(
            "(type_facturation = 'Forfait' AND tarif_forfait IS NOT NULL) "
            "OR (type_facturation = 'Consommation_reelle' "
            "AND tarif_unitaire_repas IS NOT NULL)",
            name="tarif_selon_facturation",
        ),
    )

    id_abonnement: Mapped[int] = mapped_column(primary_key=True)
    date_debut: Mapped[date] = mapped_column(Date, nullable=False)
    date_fin: Mapped[date] = mapped_column(Date, nullable=False)
    type_facturation: Mapped[TypeFacturation] = mapped_column(
        SAEnum(
            TypeFacturation,
            native_enum=False,
            create_constraint=True,
            name="type_facturation",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    mode_suivi: Mapped[ModeSuivi] = mapped_column(
        SAEnum(
            ModeSuivi,
            native_enum=False,
            create_constraint=True,
            name="mode_suivi",
            values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
        ),
        nullable=False,
    )
    nombre_repas_inclus: Mapped[int | None] = mapped_column()
    tarif_forfait: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    tarif_unitaire_repas: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    id_client_entreprise: Mapped[int] = mapped_column(
        ForeignKey("client_entreprise.id_client", ondelete="RESTRICT"),
        nullable=False,
    )

    client_entreprise: Mapped[ClientEntreprise] = relationship(
        back_populates="abonnements"
    )
    beneficiaires: Mapped[list[Beneficiaire]] = relationship(
        back_populates="abonnement", passive_deletes=True
    )
    consommations: Mapped[list[ConsommationRepas]] = relationship(
        back_populates="abonnement", passive_deletes=True
    )
