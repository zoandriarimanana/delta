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
        # Un produit vendu à la personne porte toujours un minimum, au moins 1 :
        # sans lui, rien ne dirait à partir de combien de personnes il se
        # commande. Implication et non équivalence, même raisonnement que
        # ci-dessus : un minimum dormant est toléré sur un produit à l'unité.
        #
        # `IS NOT NULL` explicite, et non `personnes_min >= 1` seul : avec un
        # minimum `NULL`, cette comparaison vaut `NULL`, que PostgreSQL laisse
        # passer — la première version de cette contrainte n'interdisait donc
        # rien. Trouvé par le test qui la viole volontairement.
        CheckConstraint(
            "(personnes_min IS NULL OR personnes_min >= 1)"
            " AND (NOT vendu_par_personne OR personnes_min IS NOT NULL)",
            name="vendu_par_personne_a_un_minimum",
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
    #: Vendu au nombre de personnes (un gâteau pour 8, par exemple) : le prix
    #: est alors **par personne**, et `LIGNE_COMMANDE.quantite` compte des
    #: personnes. `stock_disponible` compte toujours des produits entiers —
    #: une ligne de commande en consomme **un** (décision du 7 octobre 2026).
    vendu_par_personne: Mapped[bool] = mapped_column(
        nullable=False, server_default="false"
    )
    #: Nombre minimum de personnes pour un produit vendu à la personne.
    personnes_min: Mapped[int | None] = mapped_column(default=None)
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
