"""Dépendances FastAPI transverses.

Ce module fait la jonction entre les primitives de `core/security.py` — qui ne
connaissent ni le framework ni la base — et les endpoints. C'est ici que vivent
les dépendances réutilisées par plusieurs routers, à commencer par
`get_current_client`.

Voir `docs/architecture.md`, section « Authentification des endpoints protégés ».
"""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AuthentificationInvalide
from app.core.security import decoder_jeton_acces
from app.models.client import Client
from app.repositories.client_repository import ClientRepository

# `auto_error=False` : sans ça, HTTPBearer lève lui-même une HTTPException 403
# quand l'en-tête est absent — un code erroné (l'absence d'authentification est
# un 401, pas un 403) et court-circuitant nos gestionnaires globaux. On récupère
# donc `None` et on lève `AuthentificationInvalide` nous-mêmes.
schema_jeton = HTTPBearer(auto_error=False)

MESSAGE_REFUS = "Jeton d'accès absent ou invalide."


def get_current_client(
    identifiants: Annotated[HTTPAuthorizationCredentials | None, Depends(schema_jeton)],
    db: Annotated[Session, Depends(get_db)],
) -> Client:
    """Retourne le CLIENT authentifié par le jeton porté par la requête.

    Lève `AuthentificationInvalide` — traduite en 401 par les gestionnaires
    globaux de `main.py` — dans quatre cas : en-tête absent, jeton illisible ou
    signé avec une autre clé, jeton expiré, et compte disparu depuis l'émission
    du jeton. Ce dernier cas mérite d'être traité explicitement : un JWT reste
    cryptographiquement valide jusqu'à son expiration, y compris après la
    suppression du client qu'il désigne.

    Le message de refus est le même dans tous les cas : distinguer « jeton
    expiré » de « compte supprimé » renseignerait un attaquant sans servir
    l'utilisateur légitime, qui doit de toute façon se reconnecter.

    **Authentifie, n'autorise pas.** Le schéma ne porte aucune notion de rôle :
    tout client, particulier ou entreprise, est équivalent en droits.
    """
    if identifiants is None:
        raise AuthentificationInvalide(MESSAGE_REFUS)

    charge_utile = decoder_jeton_acces(identifiants.credentials)
    if charge_utile is None:
        raise AuthentificationInvalide(MESSAGE_REFUS)

    sujet = charge_utile.get("sub")
    if sujet is None:
        raise AuthentificationInvalide(MESSAGE_REFUS)

    try:
        # `sub` est une chaîne par spécification JWT (cf. `creer_jeton_acces`),
        # alors que la clé primaire est un entier.
        identifiant = int(sujet)
    except (TypeError, ValueError) as erreur:
        raise AuthentificationInvalide(MESSAGE_REFUS) from erreur

    client = ClientRepository(db).get_by_id(identifiant)
    if client is None:
        raise AuthentificationInvalide(MESSAGE_REFUS)

    return client


#: À utiliser dans les signatures d'endpoint : `client: ClientConnecte`.
ClientConnecte = Annotated[Client, Depends(get_current_client)]
