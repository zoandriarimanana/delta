"""Schemas Pydantic de l'entité CATEGORIE_PRODUIT."""

from pydantic import BaseModel, ConfigDict, Field

LONGUEUR_MAX_LIBELLE = 100


class CategorieProduitCreate(BaseModel):
    """Charge utile de création d'une catégorie."""

    libelle: str = Field(min_length=1, max_length=LONGUEUR_MAX_LIBELLE)


class CategorieProduitUpdate(BaseModel):
    """Mise à jour partielle : toute clé absente laisse la colonne inchangée.

    Le service transmet un `model_dump(exclude_unset=True)` au repository, sans
    quoi les valeurs par défaut écraseraient des colonnes non modifiées.
    """

    libelle: str | None = Field(
        default=None, min_length=1, max_length=LONGUEUR_MAX_LIBELLE
    )


class CategorieProduitRead(BaseModel):
    """Catégorie en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_categorie: int
    libelle: str
