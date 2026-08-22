"""Schemas Pydantic de l'entité DOMAINE_FORMATION."""

from pydantic import BaseModel, ConfigDict, Field

LONGUEUR_MAX_LIBELLE = 100


class DomaineFormationCreate(BaseModel):
    """Charge utile de création d'un domaine de formation."""

    libelle: str = Field(min_length=1, max_length=LONGUEUR_MAX_LIBELLE)
    description: str | None = None


class DomaineFormationUpdate(BaseModel):
    """Mise à jour partielle : toute clé absente laisse la colonne inchangée.

    Le service transmet un `model_dump(exclude_unset=True)` au repository, sans
    quoi les valeurs par défaut écraseraient des colonnes non modifiées.
    """

    libelle: str | None = Field(
        default=None, min_length=1, max_length=LONGUEUR_MAX_LIBELLE
    )
    description: str | None = None


class DomaineFormationRead(BaseModel):
    """Domaine en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    id_domaine: int
    libelle: str
    description: str | None = None
