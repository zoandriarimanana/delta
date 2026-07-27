"""Schemas Pydantic du parcours d'authentification.

Ces charges utiles ne correspondent à aucune entité unique : l'inscription d'un
particulier écrit à la fois dans `CLIENT` et dans `CLIENT_PARTICULIER`. Elles
vivent donc ici plutôt que dans le schema d'une des deux entités.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import LONGUEUR_MAX_MOT_DE_PASSE_OCTETS
from app.schemas.client_particulier import ClientParticulierCreate

LONGUEUR_MIN_MOT_DE_PASSE = 8


def _valider_longueur_mot_de_passe(mot_de_passe: str) -> str:
    """Vérifie la longueur en octets, pas en caractères.

    bcrypt refuse au-delà de 72 octets : 40 lettres accentuées suffisent à
    dépasser la limite en UTF-8 alors que `max_length=72` côté Pydantic les
    laisserait passer, l'erreur ne surgissant qu'au hachage.
    """
    if len(mot_de_passe.encode("utf-8")) > LONGUEUR_MAX_MOT_DE_PASSE_OCTETS:
        raise ValueError(
            f"Le mot de passe ne doit pas dépasser "
            f"{LONGUEUR_MAX_MOT_DE_PASSE_OCTETS} octets en UTF-8."
        )
    return mot_de_passe


class InscriptionParticulier(BaseModel):
    """Charge utile d'inscription d'un client particulier."""

    email: EmailStr
    mot_de_passe: str = Field(min_length=LONGUEUR_MIN_MOT_DE_PASSE)
    telephone: str | None = Field(default=None, max_length=30)
    adresse: str | None = Field(default=None, max_length=255)
    identite: ClientParticulierCreate

    @field_validator("mot_de_passe")
    @classmethod
    def _mot_de_passe_pas_trop_long(cls, valeur: str) -> str:
        return _valider_longueur_mot_de_passe(valeur)


class Connexion(BaseModel):
    """Identifiants de connexion. L'e-mail sert d'identifiant."""

    email: EmailStr
    mot_de_passe: str


class Token(BaseModel):
    """Jeton d'accès renvoyé après inscription ou connexion."""

    access_token: str
    token_type: str = "bearer"
