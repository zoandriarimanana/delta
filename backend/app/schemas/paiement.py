"""Schemas Pydantic de l'entité PAIEMENT."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.paiement import FournisseurPaiement, MethodePaiement, StatutPaiement
from app.models.taux_change import Devise

#: Fournisseurs de chaque méthode : la carte internationale passe par Stripe,
#: le mobile money par les trois opérateurs malgaches.
FOURNISSEURS_PAR_METHODE: dict[MethodePaiement, frozenset[FournisseurPaiement]] = {
    MethodePaiement.CARTE: frozenset({FournisseurPaiement.STRIPE}),
    MethodePaiement.MOBILE_MONEY: frozenset(
        {
            FournisseurPaiement.MVOLA,
            FournisseurPaiement.ORANGE_MONEY,
            FournisseurPaiement.AIRTEL_MONEY,
        }
    ),
}


class PaiementCreate(BaseModel):
    """Charge utile d'initiation.

    Ni `montant` ni `id_commande` : le premier est recopié depuis
    `COMMANDE.montant_total` par le service, jamais soumis par le client —
    même règle que `LIGNE_COMMANDE.prix_unitaire_applique` ; le second vient
    de l'URL (`POST /commandes/{id_commande}/paiements`).
    """

    methode: MethodePaiement
    fournisseur: FournisseurPaiement

    @model_validator(mode="after")
    def _fournisseur_de_la_methode(self) -> "PaiementCreate":
        # Une carte ne passe pas par Mvola, ni un mobile money par Stripe :
        # la combinaison serait impayable, autant la refuser en 422.
        if self.fournisseur not in FOURNISSEURS_PAR_METHODE[self.methode]:
            raise ValueError(
                f"Le fournisseur {self.fournisseur.value} ne traite pas les "
                f"paiements de type {self.methode.value}."
            )
        return self


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
    #: Exprimé dans `devise`, celle de la commande.
    montant: Decimal
    devise: Devise = Devise.MGA
    methode: MethodePaiement
    fournisseur: FournisseurPaiement
    statut: StatutPaiement
    reference_externe: str
    date_paiement: datetime
    id_commande: int
