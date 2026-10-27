"""Schemas Pydantic de DEMANDE_FORMATION (14 octobre 2026)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.demande_formation import LieuFormation, StatutDemandeFormation


class DemandeFormationCreate(BaseModel):
    """Ce que le visiteur envoie. Ni `statut`, ni `note_interne`, ni
    `id_client` : le premier naît `Nouvelle`, la deuxième appartient à
    l'administration, le troisième vient de la session."""

    sujet: str = Field(min_length=3, max_length=200)
    nombre_participants: int = Field(ge=1, le=500)
    niveau: str | None = Field(default=None, max_length=100)
    periode_souhaitee: str | None = Field(default=None, max_length=200)
    lieu: LieuFormation = LieuFormation.INDIFFERENT
    message: str | None = Field(default=None, max_length=2000)
    nom_contact: str = Field(min_length=2, max_length=150)
    contact: str = Field(min_length=5, max_length=150)


class DemandeFormationSuivi(BaseModel):
    """Ce que l'administration modifie : l'avancement et sa note."""

    statut: StatutDemandeFormation
    note_interne: str | None = Field(default=None, max_length=4000)


class DemandeFormationRead(BaseModel):
    """Demande en sortie — **administration seulement** : elle porte le nom et
    le contact du demandeur."""

    model_config = ConfigDict(from_attributes=True)

    id_demande: int
    sujet: str
    nombre_participants: int
    niveau: str | None
    periode_souhaitee: str | None
    lieu: LieuFormation
    message: str | None
    nom_contact: str
    contact: str
    statut: StatutDemandeFormation
    note_interne: str | None
    date_demande: datetime
    id_client: int | None


class DemandeFormationAccuse(BaseModel):
    """Accusé de réception rendu au demandeur : la seule chose qu'il a à
    savoir, sans renvoyer ce qu'il vient de saisir."""

    model_config = ConfigDict(from_attributes=True)

    id_demande: int
    date_demande: datetime
