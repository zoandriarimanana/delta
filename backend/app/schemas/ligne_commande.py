"""Schemas Pydantic de l'entité LIGNE_COMMANDE."""

from decimal import Decimal

from pydantic import AliasPath, BaseModel, ConfigDict, Field

from app.schemas.demande_personnalisation import (
    DemandePersonnalisationCreate,
    DemandePersonnalisationRead,
)


class LigneCommandeCreate(BaseModel):
    """Ligne demandée à la création d'une commande.

    `prix_unitaire_applique` n'y figure pas : il est recopié depuis le produit
    par le serveur. L'accepter depuis la requête laisserait le client fixer son
    propre prix.

    `personnalisation` est le **seul** chemin de création d'une
    `DEMANDE_PERSONNALISATION` : elle naît avec la ligne, dans la même
    transaction, et son supplément entre dans le calcul unique de
    `montant_total`. Aucun endpoint ne permet d'en ajouter une après coup — voir
    `docs/roadmap.md`, limite assumée du sprint 3.
    """

    id_produit: int
    quantite: int = Field(gt=0)
    personnalisation: DemandePersonnalisationCreate | None = None


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
    #: Absente pour la grande majorité des lignes : seuls les produits
    #: `est_personnalisable` peuvent en porter une.
    personnalisation: DemandePersonnalisationRead | None = None
