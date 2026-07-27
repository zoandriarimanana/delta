"""Schemas Pydantic de l'entité CLIENT."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.client import TypeClient
from app.schemas.client_particulier import ClientParticulierRead


class ClientRead(BaseModel):
    """Client en sortie d'API.

    `mot_de_passe` est volontairement absent : ce schema est la seule
    représentation d'un CLIENT exposée par l'API, et le hash ne doit jamais en
    sortir.
    """

    model_config = ConfigDict(from_attributes=True)

    id_client: int
    type_client: TypeClient
    email: EmailStr
    telephone: str | None = None
    adresse: str | None = None
    date_creation_compte: datetime
    particulier: ClientParticulierRead | None = None
