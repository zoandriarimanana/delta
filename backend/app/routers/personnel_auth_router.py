"""Endpoint de connexion du PERSONNEL.

Router distinct d'`auth_router.py`, qui traite `CLIENT` : un fichier ne mêle pas
deux entités. La séparation est aussi celle des chemins — `/auth/personnel/…` —
ce qui rend lisible, à la lecture d'une trace, quelle population s'authentifie.

Aucune inscription n'est exposée : un salarié est créé par l'annuaire ou par le
script d'amorçage, jamais en s'inscrivant lui-même.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.cookies import poser_cookies_session
from app.core.database import get_db
from app.core.rate_limit import LIMITE_CONNEXION, limiter
from app.core.security import TypeSujet, creer_jeton_acces
from app.schemas.auth import Connexion, SessionActive
from app.services.personnel_auth_service import PersonnelAuthService

router = APIRouter(prefix="/auth/personnel", tags=["authentification"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.post(
    "/connexion",
    response_model=SessionActive,
    summary="Ouvrir une session personnel",
)
@limiter.limit(LIMITE_CONNEXION)
def se_connecter(
    request: Request, identifiants: Connexion, db: SessionBase, response: Response
) -> SessionActive:
    """Vérifie les identifiants d'un membre du personnel et ouvre une session.

    Le jeton porte `type = "personnel"` : présenté à un endpoint client, il est
    refusé, et réciproquement. C'est ce qui empêche le salarié n°5 et le client
    n°5 d'être interchangeables.

    Répond 401 sans préciser si c'est l'adresse, le mot de passe ou l'absence de
    compte de connexion qui est en cause. Au-delà de `LIMITE_CONNEXION`
    tentatives par adresse IP, répond 429 — même garde que sur `/auth/connexion`
    (dette technique T0.6), même constante partagée pour que les deux limites
    évoluent ensemble.

    **Depuis T0.10**, même traitement que `/auth/connexion` : le jeton est posé
    en cookie `httpOnly` plutôt que renvoyé dans le corps — voir
    `poser_cookies_session`.

    `request: Request` est exigé par `@limiter.limit` pour identifier
    l'appelant, pas par la logique métier de cet endpoint.
    """
    personnel = PersonnelAuthService(db).authentifier(identifiants)
    jeton = creer_jeton_acces(personnel.id_personnel, TypeSujet.PERSONNEL)
    poser_cookies_session(response, jeton.jeton, jeton.csrf)
    return SessionActive(type=TypeSujet.PERSONNEL)
