"""Schemas Pydantic de l'entité PRODUIT."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

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
    est_livrable: bool = True
    id_categorie: int


class ProduitUpdate(BaseModel):
    """Mise à jour partielle. Voir `CategorieProduitUpdate` pour la convention."""

    nom: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    prix_unitaire: Decimal | None = Field(
        default=None, ge=0, max_digits=PRIX_MAX_CHIFFRES, decimal_places=PRIX_DECIMALES
    )
    unite_mesure: str | None = Field(default=None, min_length=1, max_length=30)
    stock_disponible: int | None = Field(default=None, ge=0)
    est_personnalisable: bool | None = None
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
    est_livrable: bool
    id_categorie: int
