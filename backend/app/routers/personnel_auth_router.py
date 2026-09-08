"""Endpoint de connexion du PERSONNEL.

Router distinct d'`auth_router.py`, qui traite `CLIENT` : un fichier ne mêle pas
deux entités. La séparation est aussi celle des chemins — `/auth/personnel/…` —
ce qui rend lisible, à la lecture d'une trace, quelle population s'authentifie.

Aucune inscription n'est exposée : un salarié est créé par l'annuaire ou par le
script d'amorçage, jamais en s'inscrivant lui-même.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import TypeSujet, creer_jeton_acces
from app.schemas.auth import Connexion, Token
from app.services.personnel_auth_service import PersonnelAuthService

router = APIRouter(prefix="/auth/personnel", tags=["authentification"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.post(
    "/connexion",
    response_model=Token,
    summary="Obtenir un jeton d'accès personnel",
)
def se_connecter(identifiants: Connexion, db: SessionBase) -> Token:
    """Vérifie les identifiants d'un membre du personnel et retourne un JWT.

    Le jeton porte `type = "personnel"` : présenté à un endpoint client, il est
    refusé, et réciproquement. C'est ce qui empêche le salarié n°5 et le client
    n°5 d'être interchangeables.

    Répond 401 sans préciser si c'est l'adresse, le mot de passe ou l'absence de
    compte de connexion qui est en cause.
    """
    personnel = PersonnelAuthService(db).authentifier(identifiants)
    return Token(
        access_token=creer_jeton_acces(personnel.id_personnel, TypeSujet.PERSONNEL)
    )
