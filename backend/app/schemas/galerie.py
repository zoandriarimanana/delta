"""Schemas Pydantic des photos du catalogue (stockées sur disque, sans table)."""

from pydantic import BaseModel


class PhotoRead(BaseModel):
    """Une photo, désignée par son nom de fichier `<id>-<n>.<ext>`.

    Les octets se lisent à part, sur `GET /photos/{partie}/{fichier}`.
    """

    fichier: str
