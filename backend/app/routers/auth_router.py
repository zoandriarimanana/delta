"""Endpoints d'authentification : inscription et connexion.

Aucune traduction d'erreur ici : les erreurs métier levées par `AuthService`
remontent telles quelles et sont converties en réponses HTTP par les
gestionnaires globaux de `app/main.py`.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import TypeSujet, creer_jeton_acces
from app.schemas.auth import (
    Connexion,
    InscriptionEntreprise,
    InscriptionParticulier,
    Token,
)
from app.schemas.client import ClientRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["authentification"])

# Style `Annotated` plutôt que `db: Session = Depends(get_db)` : la dépendance
# cesse d'être une valeur par défaut mutable (que `ruff` signale à juste titre
# en B008) et l'annotation devient réutilisable. À déplacer dans un module de
# dépendances partagé quand un deuxième router apparaîtra.
SessionBase = Annotated[Session, Depends(get_db)]


@router.post(
    "/inscription",
    response_model=ClientRead,
    status_code=status.HTTP_201_CREATED,
    summary="Inscrire un client particulier",
)
def inscrire(donnees: InscriptionParticulier, db: SessionBase) -> ClientRead:
    """Crée un compte particulier.

    Répond 409 si l'e-mail est déjà pris (`EmailDejaUtilise`, traduite
    globalement). Ne renvoie pas de jeton : le client enchaîne sur
    `/auth/connexion`, ce qui garde un seul chemin d'émission de jeton à
    auditer.
    """
    client = AuthService(db).inscrire_particulier(donnees)
    return ClientRead.model_validate(client)


@router.post(
    "/inscription-entreprise",
    response_model=ClientRead,
    status_code=status.HTTP_201_CREATED,
    summary="Inscrire un client entreprise",
)
def inscrire_entreprise(donnees: InscriptionEntreprise, db: SessionBase) -> ClientRead:
    """Crée un compte entreprise.

    Répond 409 si l'e-mail **ou** le numéro d'identification fiscale est déjà
    pris, avec un message distinct dans chaque cas. Ne renvoie pas de jeton :
    même choix que pour le particulier, un seul chemin d'émission à auditer.
    """
    client = AuthService(db).inscrire_entreprise(donnees)
    return ClientRead.model_validate(client)


@router.post("/connexion", response_model=Token, summary="Obtenir un jeton d'accès")
def se_connecter(identifiants: Connexion, db: SessionBase) -> Token:
    """Vérifie les identifiants et retourne un JWT.

    Répond 401 sans préciser si c'est l'e-mail ou le mot de passe qui est en
    cause (`AuthentificationInvalide`, traduite globalement).
    """
    client = AuthService(db).authentifier(identifiants)
    return Token(access_token=creer_jeton_acces(client.id_client, TypeSujet.CLIENT))
