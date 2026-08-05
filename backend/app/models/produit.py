"""Modèle SQLAlchemy de l'entité PRODUIT."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.categorie_produit import CategorieProduit
    from app.models.demande_personnalisation import DemandePersonnalisation
    from app.models.ligne_commande import LigneCommande


class Produit(SoftDeleteMixin, Base):
    """Produit vendable (pâtisserie, boulangerie, confiture...).

    `supplement_personnalisation` est le tarif que l'administrateur fixe au
    catalogue pour personnaliser ce produit. Il est **nullable**, mais pas
    librement : un produit personnalisable en porte toujours un, le `CHECK`
    ci-dessous s'en assure. `NULL` signifie donc « produit non personnalisable »
    et rien d'autre.
    """

    __tablename__ = "produit"

    __table_args__ = (
        # Un produit personnalisable sans tarif rendrait la personnalisation
        # gratuite sans que personne l'ait décidé. La contrainte est en base et
        # pas seulement dans le schema d'entrée : une reprise de données ou une
        # correction manuelle ne doit pas pouvoir créer ce trou.
        #
        # Formulée en implication (« non personnalisable OU tarif renseigné »)
        # plutôt qu'en équivalence : un produit non personnalisable a le droit
        # de porter un tarif dormant, par exemple après avoir été retiré de la
        # personnalisation sans qu'on efface son prix.
        CheckConstraint(
            "NOT est_personnalisable OR supplement_personnalisation IS NOT NULL",
            name="personnalisable_a_un_supplement",
        ),
    )

    id_produit: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    prix_unitaire: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    unite_mesure: Mapped[str] = mapped_column(String(30), nullable=False)
    stock_disponible: Mapped[int] = mapped_column(nullable=False, server_default="0")
    est_personnalisable: Mapped[bool] = mapped_column(
        nullable=False, server_default="false"
    )
    est_livrable: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    #: Tarif de la personnalisation, par unité — comme `prix_unitaire`, dont il
    #: est le voisin direct. Recopié dans `DEMANDE_PERSONNALISATION.supplement_prix`
    #: à la commande, puis figé : une évolution du catalogue ne rétroagit pas.
    supplement_personnalisation: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), default=None
    )
    id_categorie: Mapped[int] = mapped_column(
        ForeignKey("categorie_produit.id_categorie", ondelete="RESTRICT"),
        nullable=False,
    )

    categorie: Mapped[CategorieProduit] = relationship(back_populates="produits")
    lignes_commande: Mapped[list[LigneCommande]] = relationship(
        back_populates="produit", passive_deletes=True
    )
    personnalisations: Mapped[list[DemandePersonnalisation]] = relationship(
        back_populates="produit_base", passive_deletes=True
    )
