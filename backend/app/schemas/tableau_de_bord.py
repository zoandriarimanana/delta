"""Schemas du tableau de bord de l'administration (14 octobre 2026).

Lecture seule, calculée à la demande : aucune entité du MLD derrière.
"""

from datetime import date
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
    categorie: str
    unites_vendues: int
    chiffre_affaires: Decimal
    nombre_commandes: int


class InscriptionsFormationRead(BaseModel):
    """Inscriptions cumulées d'une formation sur la période."""

    id_formation: int
    titre: str
    inscrits: int
    chiffre_affaires: Decimal
    nombre_reservations: int


class PointVentes(BaseModel):
    """Un point de la courbe : un jour, ou un mois (son premier jour)."""

    debut: date
    nombre_commandes: int
    chiffre_affaires: Decimal


class VentesCategorie(BaseModel):
    """Part d'une catégorie dans les ventes de la période."""

    categorie: str
    unites_vendues: int
    chiffre_affaires: Decimal


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
    #: `jour` sur 7 et 30 jours, `mois` au-delà.
    pas: str
    #: Chiffre d'affaires par jour ou par mois, périodes sans vente à zéro.
    evolution: list[PointVentes]
    #: Ventes par catégorie, chiffre d'affaires décroissant.
    categories: list[VentesCategorie]
    #: Réservations de formation confirmées ou honorées sur la période.
    formations: list[InscriptionsFormationRead]
