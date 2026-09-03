"""Schemas Pydantic de l'entité PRODUIT."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Bornes alignées sur les colonnes du modèle : `Numeric(10, 2)` et les
# `String(n)`. Les dupliquer ici est volontaire — le schema rejette en 422 avant
# que la base n'ait à trancher, avec un message exploitable côté client.
PRIX_MAX_CHIFFRES = 10
PRIX_DECIMALES = 2


class ProduitCreate(BaseModel):
    """Charge utile de création d'un produit."""

    nom: str = Field(min_length=1, max_length=200)
    description: str | None = None
    # `ge=0` et non `gt=0` : un produit offert reste un cas légitime. Seules les
    # valeurs négatives sont refusées, conformément aux critères de l'issue.
    prix_unitaire: Decimal = Field(
        ge=0, max_digits=PRIX_MAX_CHIFFRES, decimal_places=PRIX_DECIMALES
    )
    unite_mesure: str = Field(min_length=1, max_length=30)
    stock_disponible: int = Field(default=0, ge=0)
    est_personnalisable: bool = False
    #: Tarif de la personnalisation, par unité. Obligatoire dès que
    #: `est_personnalisable` vaut `True` — voir le validateur ci-dessous.
    supplement_personnalisation: Decimal | None = Field(
        default=None, ge=0, max_digits=PRIX_MAX_CHIFFRES, decimal_places=PRIX_DECIMALES
    )
    est_livrable: bool = True
    id_categorie: int

    @model_validator(mode="after")
    def _exiger_un_supplement_si_personnalisable(self) -> "ProduitCreate":
        """Refuse un produit personnalisable sans tarif de personnalisation.

        Le `CHECK` en base dit la même chose et reste la garantie réelle, y
        compris pour les écritures hors API. Celui-ci existe pour produire un
        **422 lisible** plutôt qu'une erreur d'intégrité traduite après coup.

        Sans lui, un administrateur créerait un produit personnalisable sans
        tarif, et la personnalisation serait gratuite sans que quiconque l'ait
        décidé.
        """
        if self.est_personnalisable and self.supplement_personnalisation is None:
            raise ValueError(
                "Un produit personnalisable doit porter un "
                "supplement_personnalisation."
            )
        return self


class ProduitUpdate(BaseModel):
    """Mise à jour partielle. Voir `CategorieProduitUpdate` pour la convention.

    La cohérence entre `est_personnalisable` et `supplement_personnalisation`
    **ne peut pas** être vérifiée ici : une mise à jour partielle ne porte que
    les champs fournis, et rendre un produit personnalisable est légitime si son
    tarif est déjà en base. Seul le service, qui voit l'état courant, peut
    trancher — voir `ProduitService.modifier`.
    """

    nom: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    prix_unitaire: Decimal | None = Field(
        default=None, ge=0, max_digits=PRIX_MAX_CHIFFRES, decimal_places=PRIX_DECIMALES
    )
    unite_mesure: str | None = Field(default=None, min_length=1, max_length=30)
    stock_disponible: int | None = Field(default=None, ge=0)
    est_personnalisable: bool | None = None
    supplement_personnalisation: Decimal | None = Field(
        default=None, ge=0, max_digits=PRIX_MAX_CHIFFRES, decimal_places=PRIX_DECIMALES
    )
    est_livrable: bool | None = None
    id_categorie: int | None = None


class ProduitRead(BaseModel):
    """Produit en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_produit: int
    nom: str
    description: str | None = None
    prix_unitaire: Decimal
    unite_mesure: str
    stock_disponible: int
    est_personnalisable: bool
    #: `None` pour un produit non personnalisable.
    supplement_personnalisation: Decimal | None = None
    est_livrable: bool
    id_categorie: int


class ProduitAdministrationRead(ProduitRead):
    """Produit en sortie des listes d'**administration**, archives comprises.

    Schema **distinct** de `ProduitRead`, et non un champ optionnel ajouté à
    celui-ci : rien n'oblige à publier la date d'archivage d'un produit à un
    visiteur anonyme, et un oubli de condition serait invisible alors qu'un
    mauvais schema se voit dans la signature de l'endpoint. Même raisonnement
    que `LivraisonRead` face à `LivraisonPublique`.

    `supprime_le` est ce qui permet à l'écran de distinguer les deux états —
    `None` pour actif, une date pour archivé — et donc de proposer « archiver »
    ou « restaurer ». Sans lui, la liste mêlerait les deux sans les séparer.
    """

    #: `None` si le produit est actif, horodatage de l'archivage sinon.
    supprime_le: datetime | None = None
