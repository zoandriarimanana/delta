"""Schemas Pydantic de l'entité CLIENT_ENTREPRISE."""

from pydantic import BaseModel, ConfigDict, Field


class ClientEntrepriseRead(BaseModel):
    """Identité d'un client entreprise, en sortie d'API."""

    model_config = ConfigDict(from_attributes=True)

    raison_sociale: str
    numero_id_fiscal: str
    secteur_activite: str | None = None
    nom_contact_referent: str | None = None


class ClientEntrepriseCreate(BaseModel):
    """Partie « identité » de la charge utile d'inscription entreprise.

    `raison_sociale` et `numero_id_fiscal` sont obligatoires : le premier
    identifie la société pour l'utilisateur, le second l'identifie de façon
    unique en base (`uq_client_entreprise_numero_id_fiscal`).
    """

    raison_sociale: str = Field(min_length=1, max_length=200)
    numero_id_fiscal: str = Field(min_length=1, max_length=50)
    secteur_activite: str | None = Field(default=None, max_length=100)
    nom_contact_referent: str | None = Field(default=None, max_length=150)
