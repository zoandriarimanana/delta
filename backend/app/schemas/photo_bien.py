"""Schemas Pydantic de l'entité PHOTO_BIEN."""

from pydantic import BaseModel, ConfigDict

#: Longueur de la colonne `legende`, répétée côté routeur pour un 422 lisible.
LONGUEUR_LEGENDE = 200


class PhotoBienRead(BaseModel):
    """Photo en sortie d'API — **sans les octets**.

    Les octets se lisent à part, sur `GET /photos-biens/{id_photo}` : une liste
    qui les embarquerait en base64 pèserait plusieurs mégaoctets pour afficher
    une fiche, et ne se mettrait jamais en cache.
    """

    model_config = ConfigDict(from_attributes=True)

    id_photo: int
    legende: str | None = None
