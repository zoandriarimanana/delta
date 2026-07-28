"""Schemas Pydantic de l'entité LIGNE_COMMANDE."""

from decimal import Decimal

from pydantic import AliasPath, BaseModel, ConfigDict, Field


class LigneCommandeCreate(BaseModel):
    """Ligne demandée à la création d'une commande.

    `prix_unitaire_applique` n'y figure pas : il est recopié depuis le produit
    par le serveur. L'accepter depuis la requête laisserait le client fixer son
    propre prix.
    """

    id_produit: int
    quantite: int = Field(gt=0)


class LigneCommandeRead(BaseModel):
    """Ligne de commande en sortie d'API.

    `nom_produit` est joint pour l'affichage : sans lui, lire une commande
    imposerait un appel par ligne au catalogue. Il est lu à travers la relation
    par `AliasPath`, ce qui évite d'ajouter une propriété de présentation au
    modèle SQLAlchemy.
    """

    model_config = ConfigDict(from_attributes=True)

    id_ligne: int
    id_produit: int
    nom_produit: str = Field(validation_alias=AliasPath("produit", "nom"))
    quantite: int
    prix_unitaire_applique: Decimal
