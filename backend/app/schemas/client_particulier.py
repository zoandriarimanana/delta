"""Schemas Pydantic de l'entité CLIENT_PARTICULIER."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class ClientParticulierRead(BaseModel):
    """Données d'identité d'un client particulier, en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    nom: str
    prenom: str
    date_naissance: date | None = None


class ClientParticulierCreate(BaseModel):
    """Partie « identité » de la charge utile d'inscription."""

    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    date_naissance: date | None = None
