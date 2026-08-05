"""Point d'assemblage de l'application FastAPI.

Ce fichier ne contient aucune logique métier : il monte les routers, configure
le CORS et enregistre la traduction des erreurs métier en réponses HTTP.

Cette traduction est **globale** et non répétée dans chaque router : le mapping
« erreur métier → code HTTP » est une décision d'application, pas de module. Un
service lève `ConflitMetier` sans jamais savoir que cela vaudra un 409.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import (
    AuthentificationInvalide,
    AutorisationInsuffisante,
    ConflitMetier,
    ErreurMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.routers import (
    auth_router,
    categorie_produit_router,
    commande_router,
    personnel_auth_router,
    personnel_router,
    produit_router,
)

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    # Liste explicite d'origines, jamais "*" : `allow_credentials=True` et
    # l'origine joker sont incompatibles, et les navigateurs rejettent la
    # combinaison. L'origine du frontend Vite vient de BACKEND_CORS_ORIGINS.
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AuthentificationInvalide)
async def _gerer_authentification_invalide(
    request: Request, exc: AuthentificationInvalide
) -> JSONResponse:
    """Identifiants refusés → 401, avec l'en-tête d'authentification attendu."""
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": str(exc)},
        headers={"WWW-Authenticate": "Bearer"},
    )


@app.exception_handler(AutorisationInsuffisante)
async def _gerer_autorisation_insuffisante(
    request: Request, exc: AutorisationInsuffisante
) -> JSONResponse:
    """Droits insuffisants → 403.

    Pas d'en-tête `WWW-Authenticate` ici, contrairement au 401 : il invite à
    fournir des identifiants, or ceux-ci sont valides. Ce n'est pas
    l'authentification qui manque, c'est le droit.
    """
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN, content={"detail": str(exc)}
    )


@app.exception_handler(ConflitMetier)
async def _gerer_conflit_metier(request: Request, exc: ConflitMetier) -> JSONResponse:
    """Ressource déjà existante ou état incompatible → 409."""
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT, content={"detail": str(exc)}
    )


@app.exception_handler(RessourceIntrouvable)
async def _gerer_ressource_introuvable(
    request: Request, exc: RessourceIntrouvable
) -> JSONResponse:
    """Ressource désignée par l'URL absente → 404."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(exc)}
    )


@app.exception_handler(ReferenceInvalide)
async def _gerer_reference_invalide(
    request: Request, exc: ReferenceInvalide
) -> JSONResponse:
    """Clé étrangère du corps ne désignant rien → 422, jamais 404.

    L'URL est valide, c'est le contenu envoyé qui ne l'est pas — au même titre
    qu'un prix négatif. Voir `docs/architecture.md`.
    """
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": str(exc)}
    )


@app.exception_handler(ErreurMetier)
async def _gerer_erreur_metier(request: Request, exc: ErreurMetier) -> JSONResponse:
    """Filet pour toute erreur métier sans traduction dédiée → 400.

    Enregistré en dernier recours : Starlette parcourt la MRO de l'exception et
    retient le gestionnaire le plus spécifique, donc une `ConflitMetier` est
    bien servie par le handler ci-dessus, pas par celui-ci.
    """
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST, content={"detail": str(exc)}
    )


app.include_router(auth_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(categorie_produit_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(produit_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(commande_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(personnel_auth_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(personnel_router.router, prefix=settings.API_V1_PREFIX)
