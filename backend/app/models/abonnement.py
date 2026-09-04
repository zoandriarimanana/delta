"""Modèle SQLAlchemy de l'entité ABONNEMENT (cantine B2B)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, literal_column, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ExcludeConstraint
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


#: Nom de la contrainte d'exclusion, repris par le service pour traduire une
#: violation en 409 lisible (cf. `ReservationService._viole_exclusion`).
CONTRAINTE_SANS_CHEVAUCHEMENT = "abonnement_sans_chevauchement"


def _exclusion_chevauchement() -> ExcludeConstraint:
    """Interdit deux abonnements actifs qui se recoupent, pour une même entreprise.

    `ABONNEMENT` n'a qu'un lien vers `CLIENT_ENTREPRISE`, pas vers un site ou
    un département : rien dans le MLD ne distingue « deux abonnements pour
    deux filiales » d'une double souscription par erreur. Sans cette garantie,
    `CONSOMMATION_REPAS.#id_abonnement` n'aurait aucun moyen de départager
    quel abonnement décompte un repas donné un jour couvert par les deux.

    `daterange(date_debut, date_fin)` a des bornes `[)` par défaut : un
    renouvellement qui commence le jour où l'ancien abonnement se termine
    n'est **pas** un chevauchement — c'est le cas courant d'un contrat qui
    succède à un autre.

    C'est **la** garantie contre la double souscription. Une vérification
    applicative seule laisserait passer deux créations simultanées : il n'y a
    ici aucun compteur sur lequel poser un verrou de ligne, contrairement à
    `places_restantes` ou `stock_disponible`. Même raisonnement que
    `RESERVATION` sur `SALLE`/`LOGEMENT` (#47) — la règle ne croise ici aucune
    autre table (`date_debut`, `date_fin`, `id_client_entreprise` vivent tous
    sur `ABONNEMENT`), rien n'empêche donc de la poser en base.

    `USING gist` avec l'opérateur `=` sur un entier exige l'extension
    `btree_gist`, déjà créée par la migration acadf9ddce27 (contraintes
    d'exclusion de `RESERVATION`).
    """
    return ExcludeConstraint(
        ("id_client_entreprise", "="),
        (literal_column("daterange(date_debut, date_fin)"), "&&"),
        name=CONTRAINTE_SANS_CHEVAUCHEMENT,
        using="gist",
        where=text("supprime_le IS NULL"),
    )


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
        _exclusion_chevauchement(),
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
