"""Primitives de sécurité : hachage de mot de passe et jetons JWT.

Ce module ne connaît ni les entités métier ni la base : il manipule des chaînes
et des dates. Toute la logique d'inscription/connexion vit dans
`services/auth_service.py`.
"""

from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# bcrypt tronque silencieusement au-delà de 72 **octets** (pas caractères :
# 40 lettres accentuées font déjà 80 octets en UTF-8). On refuse explicitement
# plutôt que de tronquer, sinon deux mots de passe distincts partageant leurs
# 72 premiers octets ouvriraient le même compte.
LONGUEUR_MAX_MOT_DE_PASSE_OCTETS = 72

#: Nom de la revendication qui porte la nature du sujet dans le jeton.
REVENDICATION_TYPE = "type"


class TypeSujet(StrEnum):
    """Nature du compte qu'un jeton désigne.

    `CLIENT` et `PERSONNEL` sont deux tables distinctes, dont les clés primaires
    se recouvrent : le client n°5 et le salarié n°5 existent tous les deux. Sans
    cette revendication, leurs jetons seraient **indiscernables** et
    `get_current_client` chargerait un client à partir du jeton d'un salarié.
    Ce n'est pas un inconfort de typage, c'est une confusion d'identité.

    La revendication est fixée à l'émission et vérifiée à chaque lecture ; un
    jeton qui n'en porte pas est rejeté.
    """

    CLIENT = "client"
    PERSONNEL = "personnel"


class MotDePasseTropLong(ValueError):
    """Le mot de passe dépasse la limite technique de bcrypt."""


def hacher_mot_de_passe(mot_de_passe: str) -> str:
    """Retourne le hash bcrypt du mot de passe, sel compris.

    Lève `MotDePasseTropLong` si la limite de bcrypt est dépassée.
    """
    en_octets = mot_de_passe.encode("utf-8")
    if len(en_octets) > LONGUEUR_MAX_MOT_DE_PASSE_OCTETS:
        raise MotDePasseTropLong(
            f"Le mot de passe dépasse {LONGUEUR_MAX_MOT_DE_PASSE_OCTETS} octets."
        )
    return bcrypt.hashpw(en_octets, bcrypt.gensalt()).decode("utf-8")


def verifier_mot_de_passe(mot_de_passe: str, hash_attendu: str) -> bool:
    """Compare un mot de passe en clair au hash stocké.

    Retourne False plutôt que de lever si le hash est illisible : un
    enregistrement corrompu ne doit pas provoquer une erreur 500 sur une
    tentative de connexion.
    """
    try:
        return bcrypt.checkpw(
            mot_de_passe.encode("utf-8"), hash_attendu.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


def creer_jeton_acces(
    sujet: str | int,
    type_sujet: TypeSujet,
    duree: timedelta | None = None,
) -> str:
    """Signe un JWT dont le `sub` identifie le compte et `type` sa nature.

    `sub` est converti en chaîne : la spécification JWT impose une chaîne, et
    python-jose ne le fait pas à notre place.

    `type_sujet` est un paramètre **obligatoire et sans valeur par défaut**.
    C'est délibéré : un défaut ferait qu'un futur appelant émettrait un jeton
    client sans s'en rendre compte. Le compilateur pose ici la question à notre
    place, à chaque nouveau point d'émission.
    """
    expiration = datetime.now(UTC) + (
        duree or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    charge_utile = {
        "sub": str(sujet),
        REVENDICATION_TYPE: TypeSujet(type_sujet).value,
        "exp": expiration,
    }
    return jwt.encode(charge_utile, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decoder_jeton_acces(jeton: str) -> dict[str, Any] | None:
    """Valide signature et expiration, et retourne la charge utile.

    Retourne None si le jeton est invalide, expiré ou signé avec une autre clé —
    l'appelant traduit ce None en 401, il n'a pas à distinguer les cas (ne pas
    renseigner un attaquant sur la raison du rejet).
    """
    try:
        return jwt.decode(jeton, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
