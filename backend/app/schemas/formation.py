"""Schemas Pydantic de l'entité FORMATION."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

# Bornes alignées sur les colonnes du modèle. Les dupliquer ici est volontaire :
# le schema rejette en 422 avec un message exploitable, avant que la base n'ait à
# trancher.
PRIX_MAX_CHIFFRES = 10
PRIX_DECIMALES = 2
LONGUEUR_TITRE = 200
LONGUEUR_NIVEAU = 50


class FormationCreate(BaseModel):
    """Charge utile de création d'une formation.

    `niveau` reste une **chaîne libre**, contrairement aux domaines formels du
    projet (`type_commande`, `statut`, `fonction`). Ceux-là ont été contraints
    parce qu'une règle de service comparait leur valeur ; ici aucune ne le fait,
    `niveau` sert à afficher et à filtrer. Le contraindre imposerait une
    migration à chaque nouvelle offre commerciale.
    """

    titre: str = Field(min_length=1, max_length=LONGUEUR_TITRE)
    niveau: str | None = Field(default=None, max_length=LONGUEUR_NIVEAU)
    # `gt=0` et non `ge=0` : une formation de zéro heure n'est pas une
    # formation, contrairement à un produit offert dont le prix peut être nul.
    duree_heures: int = Field(gt=0)
    prix: Decimal = Field(
        ge=0, max_digits=PRIX_MAX_CHIFFRES, decimal_places=PRIX_DECIMALES
    )
    # Une capacité nulle rendrait toute session complète dès sa création.
    capacite_max: int = Field(gt=0)
    propose_hebergement: bool = False
    id_domaine: int


class FormationUpdate(BaseModel):
    """Mise à jour partielle. Voir `DomaineFormationUpdate` pour la convention."""

    titre: str | None = Field(default=None, min_length=1, max_length=LONGUEUR_TITRE)
    niveau: str | None = Field(default=None, max_length=LONGUEUR_NIVEAU)
    duree_heures: int | None = Field(default=None, gt=0)
    prix: Decimal | None = Field(
        default=None, ge=0, max_digits=PRIX_MAX_CHIFFRES, decimal_places=PRIX_DECIMALES
    )
    capacite_max: int | None = Field(default=None, gt=0)
    propose_hebergement: bool | None = None
    id_domaine: int | None = None


class FormationRead(BaseModel):
    """Formation en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_formation: int
    titre: str
    niveau: str | None = None
    duree_heures: int
    prix: Decimal
    capacite_max: int
    propose_hebergement: bool
    id_domaine: int
