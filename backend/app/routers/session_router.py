"""Endpoints de session transverses aux deux populations (dette T0.10).

Ni `auth_router.py` (CLIENT) ni `personnel_auth_router.py` (PERSONNEL) ne sont
le bon endroit pour `GET /auth/moi` et `POST /auth/deconnexion` : les deux
répondent à une question qui ne connaît pas encore la population avant
d'avoir lu le cookie — leur donner un propriétaire parmi les deux routers
existants aurait forcé un choix arbitraire. Ce fichier les regroupe, sans
porter aucune autre logique.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.cookies import effacer_cookies_session
from app.core.database import get_db
from app.core.deps import get_sujet_optionnel
from app.core.exceptions import AuthentificationInvalide
from app.core.security import TypeSujet
from app.models.personnel import Personnel
from app.schemas.auth import SessionActive

router = APIRouter(prefix="/auth", tags=["authentification"])

SessionBase = Annotated[Session, Depends(get_db)]

MESSAGE_REFUS = "Jeton d'accès absent ou invalide."


@router.get("/moi", response_model=SessionActive, summary="Session en cours")
def lire_ma_session(request: Request, db: SessionBase) -> SessionActive:
    """Retourne la population de la session portée par le cookie, ou 401.

    Remplace la lecture directe du jeton, impossible depuis T0.10 : le cookie
    `delta_session` est `httpOnly`, donc invisible en JS. C'est l'endpoint que
    le frontend interroge au chargement de l'application pour savoir s'il y a
    une session à afficher.

    **Porte `est_administrateur`, mais pour l'affichage seulement** (chantier
    sidebar) : `None` pour un `CLIENT`, `True`/`False` pour un `PERSONNEL`.
    Authentifier n'est toujours pas autoriser — voir `SessionActive`. Aucun
    endpoint d'écriture ne se fie à cette valeur, la garantie reste
    `get_current_personnel_administrateur`.
    """
    resultat = get_sujet_optionnel(request, db)
    if resultat is None:
        raise AuthentificationInvalide(MESSAGE_REFUS)

    type_sujet, sujet = resultat
    est_administrateur = (
        sujet.est_administrateur
        if type_sujet is TypeSujet.PERSONNEL and isinstance(sujet, Personnel)
        else None
    )
    return SessionActive(type=type_sujet, est_administrateur=est_administrateur)


@router.post("/deconnexion", status_code=204, summary="Fermer la session")
def se_deconnecter(response: Response) -> None:
    """Efface les cookies de session.

    Nécessaire côté serveur et non côté frontend : `delta_session` est
    `httpOnly`, aucun script ne peut l'effacer depuis le navigateur. Ne
    vérifie pas qu'une session existait — effacer un cookie déjà absent est
    sans effet, pas une erreur.
    """
    effacer_cookies_session(response)
