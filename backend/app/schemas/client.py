"""Schemas Pydantic de l'entité CLIENT."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

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
    # `str` et non `EmailStr` : ce schema sérialise une valeur qui vient de
    # notre propre base, la revalider est inutile — et nuisible. L'adresse d'un
    # client anonymisé (`supprime+42@delta.invalid`) est un nom de domaine
    # réservé par la RFC 2606, qu'`EmailStr` refuse : la lecture d'un compte
    # anonymisé échouerait en 500. La validation reste stricte à l'entrée,
    # là où elle protège (voir `schemas/auth.py`).
    email: str
    telephone: str | None = None
    adresse: str | None = None
    date_creation_compte: datetime
    particulier: ClientParticulierRead | None = None
