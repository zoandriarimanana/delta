"""Schemas Pydantic de l'entité PAIEMENT."""

import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

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


#: Préfixes des numéros mobiles malgaches, par opérateur de mobile money.
#: Pas de portabilité des numéros à Madagascar : le préfixe désigne bien
#: l'opérateur — un numéro Orange ne peut pas payer par MVola.
PREFIXES_PAR_FOURNISSEUR: dict[FournisseurPaiement, frozenset[str]] = {
    FournisseurPaiement.MVOLA: frozenset({"034", "038"}),
    FournisseurPaiement.ORANGE_MONEY: frozenset({"032", "037"}),
    FournisseurPaiement.AIRTEL_MONEY: frozenset({"033"}),
}

#: Nom commercial, pour les messages d'erreur.
NOMS_FOURNISSEURS: dict[FournisseurPaiement, str] = {
    FournisseurPaiement.MVOLA: "MVola",
    FournisseurPaiement.ORANGE_MONEY: "Orange Money",
    FournisseurPaiement.AIRTEL_MONEY: "Airtel Money",
    FournisseurPaiement.STRIPE: "Stripe",
}

_NUMERO_LOCAL = re.compile(r"^03[2-9]\d{7}$")


def normaliser_numero(brut: str) -> str:
    """Ramène un numéro malgache à sa forme locale à 10 chiffres (034 12 345 67).

    Accepte les espaces, tirets et points, ainsi que l'indicatif +261 / 00261 /
    261. Lève `ValueError` si le résultat n'est pas un numéro mobile valide.
    """
    chiffres = re.sub(r"[\s.\-()]", "", brut)
    for indicatif in ("+261", "00261", "261"):
        if chiffres.startswith(indicatif):
            chiffres = "0" + chiffres[len(indicatif) :]
            break
    if not _NUMERO_LOCAL.match(chiffres):
        raise ValueError(
            "Numéro mobile money invalide : attendu un numéro malgache à 10 chiffres "
            "(ex. 034 12 345 67)."
        )
    return chiffres


class PaiementCreate(BaseModel):
    """Charge utile d'initiation.

    Ni `montant` ni `id_commande` : le premier est recopié depuis
    `COMMANDE.montant_total` par le service, jamais soumis par le client —
    même règle que `LIGNE_COMMANDE.prix_unitaire_applique` ; le second vient
    de l'URL (`POST /commandes/{id_commande}/paiements`).
    """

    methode: MethodePaiement
    fournisseur: FournisseurPaiement
    #: Numéro du portefeuille à débiter, **exigé pour le mobile money** : c'est
    #: lui qui reçoit la demande de validation (code secret) de l'opérateur.
    #: Transmis à la passerelle et **jamais stocké** — `PAIEMENT` n'en a pas
    #: besoin, sa `reference_externe` suffit à le retrouver chez l'opérateur
    #: (minimisation des données personnelles, cf. `docs/mld.md`).
    numero_mobile_money: str | None = None

    @field_validator("numero_mobile_money")
    @classmethod
    def _numero_normalise(cls, valeur: str | None) -> str | None:
        if valeur is None or not valeur.strip():
            return None
        return normaliser_numero(valeur)

    @model_validator(mode="after")
    def _fournisseur_de_la_methode(self) -> "PaiementCreate":
        # Une carte ne passe pas par Mvola, ni un mobile money par Stripe :
        # la combinaison serait impayable, autant la refuser en 422.
        if self.fournisseur not in FOURNISSEURS_PAR_METHODE[self.methode]:
            raise ValueError(
                f"Le fournisseur {self.fournisseur.value} ne traite pas les "
                f"paiements de type {self.methode.value}."
            )
        if self.methode == MethodePaiement.MOBILE_MONEY:
            if self.numero_mobile_money is None:
                raise ValueError(
                    "Indiquez le numéro mobile money qui recevra la demande "
                    "de paiement."
                )
            prefixes = PREFIXES_PAR_FOURNISSEUR[self.fournisseur]
            if self.numero_mobile_money[:3] not in prefixes:
                nom = NOMS_FOURNISSEURS[self.fournisseur]
                raise ValueError(
                    f"Ce numéro n'est pas un numéro {nom} "
                    f"(préfixes acceptés : {', '.join(sorted(prefixes))})."
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
