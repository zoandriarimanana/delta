"""Modèle SQLAlchemy de TARIF_LIVRAISON — le prix de la livraison.

**Une seule ligne**, `id_tarif = 1`, posée par la migration : décision de
l'utilisateur (7 octobre 2026) — un forfait unique, compté une fois par
commande, offert au-delà d'un seuil, réglable par l'administrateur.

Le montant appliqué est **recopié** dans `COMMANDE.frais_livraison` à la
commande, puis figé : changer le tarif ne rétroagit jamais sur une commande
passée, même règle que `LIGNE_COMMANDE.prix_unitaire_applique`. Aucun
historique n'est donc nécessaire ici.
"""

from decimal import Decimal

from sqlalchemy import CheckConstraint, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, SoftDeleteMixin

#: Identifiant de l'unique ligne — le `CHECK` interdit toute autre valeur.
ID_TARIF = 1


class TarifLivraison(SoftDeleteMixin, Base):
    """Forfait de livraison et seuil de gratuité."""

    __tablename__ = "tarif_livraison"
    __table_args__ = (
        # Une table de réglage, pas un catalogue : une deuxième ligne n'aurait
        # aucun sens, et rien ne dirait laquelle appliquer.
        CheckConstraint(f"id_tarif = {ID_TARIF}", name="ligne_unique"),
        CheckConstraint("forfait >= 0", name="forfait_positif"),
        # `NULL` : la livraison n'est jamais offerte. Un seuil à 0 la rendrait
        # toujours gratuite — c'est `forfait = 0` qui dit cela, pas le seuil.
        CheckConstraint(
            "seuil_gratuite IS NULL OR seuil_gratuite > 0",
            name="seuil_strictement_positif",
        ),
    )

    id_tarif: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    forfait: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    seuil_gratuite: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
