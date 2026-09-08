"""Schemas Pydantic de l'entité DEMANDE_PERSONNALISATION."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

# Bornes alignées sur les colonnes du modèle. Les dupliquer ici est volontaire :
# le schema rejette en 422 avec un message exploitable, avant que la base n'ait à
# trancher.
LONGUEUR_DESCRIPTION = 2000


class DemandePersonnalisationCreate(BaseModel):
    """Demande jointe à une ligne, **à la création de la commande uniquement**.

    Deux champs du modèle sont délibérément absents.

    `supplement_prix` n'est pas accepté depuis la requête, pour la même raison
    que `prix_unitaire_applique` sur `LigneCommandeCreate` : l'accepter
    laisserait le client fixer ce qu'il paie, et il suffirait d'envoyer `0` pour
    obtenir une personnalisation gratuite. Il est posé par le serveur.

    `id_produit_base` non plus : il est déduit du produit de la ligne. Le MLD le
    porte comme colonne distincte, mais le laisser saisir ouvrirait une
    incohérence — une demande dont le produit de base ne serait pas celui qu'on
    commande — qu'il faudrait ensuite détecter et refuser. La déduire supprime le
    cas au lieu de le valider.
    """

    description_demande: str = Field(min_length=1, max_length=LONGUEUR_DESCRIPTION)
    ingredients_specifiques: str | None = Field(
        default=None, max_length=LONGUEUR_DESCRIPTION
    )


class DemandePersonnalisationRead(BaseModel):
    """Demande de personnalisation en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_personnalisation: int
    description_demande: str
    ingredients_specifiques: str | None = None
    supplement_prix: Decimal
    id_produit_base: int
