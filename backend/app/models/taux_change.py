"""Modèle SQLAlchemy de TAUX_CHANGE — la conversion d'une devise en Ariary.

Ouverture internationale (demande du 8 octobre 2026) : un client étranger
paie **réellement** dans sa devise. Le catalogue reste tenu en Ariary — un
prix n'existe qu'une fois —, et la conversion se fait à la commande, avec le
taux de cette table, réglé par un administrateur.

Le taux appliqué est **recopié** dans `COMMANDE.taux_change` puis figé, même
règle que `TARIF_LIVRAISON` et `prix_unitaire_applique` : changer un taux ne
rétroagit jamais sur une commande passée. Aucun historique n'est donc
nécessaire ici.

`MGA` n'a pas de ligne : son taux vaut 1 par définition, et le stocker
permettrait de le rendre faux.
"""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Numeric, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, SoftDeleteMixin


class Devise(StrEnum):
    """Devises acceptées (codes ISO 4217).

    Liste **fermée**, comme `PAIEMENT.fournisseur` : une devise non prévue
    impose une migration, délibérément — elle suppose un taux, et un moyen de
    paiement qui sache l'encaisser.
    """

    MGA = "MGA"
    EUR = "EUR"
    USD = "USD"


#: Devise du catalogue : les prix y sont tenus, le taux y vaut 1.
DEVISE_DE_REFERENCE = Devise.MGA


def type_devise(nom: str) -> SAEnum:
    """Colonne de devise : domaine formel, `CHECK` en base."""
    return SAEnum(
        Devise,
        native_enum=False,
        create_constraint=True,
        length=3,
        name=nom,
        values_callable=lambda enum_cls: [membre.value for membre in enum_cls],
    )


class TauxChange(SoftDeleteMixin, Base):
    """Valeur d'une unité de devise étrangère, en Ariary."""

    __tablename__ = "taux_change"
    __table_args__ = (
        CheckConstraint("ariary_par_unite > 0", name="taux_strictement_positif"),
        # MGA se convertit en lui-même : une ligne MGA ne pourrait que mentir.
        CheckConstraint("devise <> 'MGA'", name="pas_de_taux_pour_l_ariary"),
    )

    id_taux: Mapped[int] = mapped_column(primary_key=True)
    devise: Mapped[Devise] = mapped_column(
        type_devise("devise_taux"), unique=True, nullable=False
    )
    #: Combien d'Ariary vaut **une** unité de la devise (1 EUR = 5 000 Ar).
    #: Quatre décimales : un taux se publie plus finement qu'un prix.
    ariary_par_unite: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    #: Date du dernier réglage, montrée au client : un taux n'a de sens
    #: qu'avec sa date.
    mis_a_jour_le: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
