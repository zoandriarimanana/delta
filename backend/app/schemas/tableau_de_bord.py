"""Schemas du tableau de bord de l'administration (14 octobre 2026).

Lecture seule, calculée à la demande : aucune entité du MLD derrière.
"""

from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel


class Periode(StrEnum):
    """Périodes proposées par l'écran ; `tout` couvre tout l'historique."""

    SEPT_JOURS = "7j"
    TRENTE_JOURS = "30j"
    DOUZE_MOIS = "12m"
    TOUT = "tout"


class VenteProduitRead(BaseModel):
    """Ventes cumulées d'un produit sur la période."""

    id_produit: int
    nom: str
    unites_vendues: int
    chiffre_affaires: Decimal
    nombre_commandes: int


class TableauDeBordRead(BaseModel):
    """Chiffres clés et classement des produits sur la période."""

    periode: Periode
    chiffre_affaires: Decimal
    nombre_commandes: int
    panier_moyen: Decimal
    #: Commandes en attente de confirmation, **toutes périodes** : ce qui
    #: attend une décision ne dépend pas de la période regardée.
    commandes_a_confirmer: int
    #: Tous les produits vendus sur la période, par quantité décroissante.
    produits: list[VenteProduitRead]
