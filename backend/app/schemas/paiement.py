"""Schemas Pydantic de l'entité PAIEMENT."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.paiement import FournisseurPaiement, MethodePaiement, StatutPaiement


class PaiementCreate(BaseModel):
    """Charge utile d'initiation.

    Ni `montant` ni `id_commande` : le premier est recopié depuis
    `COMMANDE.montant_total` par le service, jamais soumis par le client —
    même règle que `LIGNE_COMMANDE.prix_unitaire_applique` ; le second vient
    de l'URL (`POST /commandes/{id_commande}/paiements`).
    """

    methode: MethodePaiement
    fournisseur: FournisseurPaiement


class WebhookPaiement(BaseModel):
    """Charge utile de la confirmation reçue par webhook.

    Validée **après** la vérification de signature (cf. `paiement_router.py`)
    : un corps illisible sans signature valide ne doit rien révéler sur ce
    que le service attend, la vérification de signature doit rester le tout
    premier obstacle.
    """

    reference_externe: str
    statut: StatutPaiement


class PaiementRead(BaseModel):
    """Paiement en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_paiement: int
    montant: Decimal
    methode: MethodePaiement
    fournisseur: FournisseurPaiement
    statut: StatutPaiement
    reference_externe: str
    date_paiement: datetime
    id_commande: int
