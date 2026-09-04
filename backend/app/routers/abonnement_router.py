"""Endpoints de ABONNEMENT.

Deux populations, deux portées : un client entreprise gère son propre
abonnement (`/abonnements`), un administrateur gère tous les abonnements
(`/abonnements/administration`).

**L'ordre de déclaration est significatif.** `/administration` et
`/administration/{id_abonnement}` sont déclarées avant `/{id_abonnement}` :
sinon, la route paramétrée du client capterait `administration` comme un
identifiant — FastAPI y répondrait 422 (« administration n'est pas un entier
valide ») au lieu d'atteindre la route d'administration. Même piège que
documenté pour `/produits/administration` (PR #90).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ClientConnecte, PersonnelAdministrateur
from app.schemas.abonnement import (
    AbonnementCreate,
    AbonnementCreateAdmin,
    AbonnementRead,
    AbonnementUpdate,
)
from app.services.abonnement_service import AbonnementService

router = APIRouter(prefix="/abonnements", tags=["abonnement"])

SessionBase = Annotated[Session, Depends(get_db)]


# --- Client entreprise (routes sans cible, avant toute route paramétrée) ---


@router.post(
    "",
    response_model=AbonnementRead,
    status_code=status.HTTP_201_CREATED,
    summary="Souscrire un abonnement pour son entreprise",
)
def creer(
    donnees: AbonnementCreate, client: ClientConnecte, db: SessionBase
) -> AbonnementRead:
    """**403** si le compte connecté n'est pas une entreprise."""
    return AbonnementRead.model_validate(AbonnementService(db).creer(donnees, client))


@router.get("", response_model=list[AbonnementRead], summary="Mes abonnements")
def lister(client: ClientConnecte, db: SessionBase) -> list[AbonnementRead]:
    """Abonnements de l'entreprise cliente connectée, les plus récents d'abord."""
    abonnements = AbonnementService(db).lister_du_client_entreprise(client)
    return [AbonnementRead.model_validate(a) for a in abonnements]


# --- Administration (segments littéraux : doivent précéder /{id_abonnement}) ---


@router.post(
    "/administration",
    response_model=AbonnementRead,
    status_code=status.HTTP_201_CREATED,
    summary="Souscrire un abonnement pour une entreprise cliente",
)
def creer_pour_entreprise(
    donnees: AbonnementCreateAdmin, admin: PersonnelAdministrateur, db: SessionBase
) -> AbonnementRead:
    """**422** si `id_client_entreprise` ne désigne aucune entreprise cliente."""
    return AbonnementRead.model_validate(
        AbonnementService(db).creer_pour_entreprise(donnees)
    )


@router.get(
    "/administration",
    response_model=list[AbonnementRead],
    summary="Lister tous les abonnements",
)
def lister_administration(
    admin: PersonnelAdministrateur, db: SessionBase
) -> list[AbonnementRead]:
    abonnements = AbonnementService(db).lister()
    return [AbonnementRead.model_validate(a) for a in abonnements]


@router.get(
    "/administration/{id_abonnement}",
    response_model=AbonnementRead,
    summary="Obtenir un abonnement (administration)",
)
def obtenir_administration(
    id_abonnement: int, admin: PersonnelAdministrateur, db: SessionBase
) -> AbonnementRead:
    return AbonnementRead.model_validate(AbonnementService(db).obtenir(id_abonnement))


@router.put(
    "/administration/{id_abonnement}",
    response_model=AbonnementRead,
    summary="Modifier un abonnement (administration)",
)
def modifier(
    id_abonnement: int,
    donnees: AbonnementUpdate,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> AbonnementRead:
    """**422** si la combinaison type de facturation / tarifs devient incohérente."""
    return AbonnementRead.model_validate(
        AbonnementService(db).modifier(id_abonnement, donnees)
    )


@router.delete(
    "/administration/{id_abonnement}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver un abonnement (administration)",
)
def supprimer(
    id_abonnement: int, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    """Archive la ligne. Aucun `DELETE` SQL n'est émis."""
    AbonnementService(db).supprimer(id_abonnement)


# --- Client entreprise (route paramétrée, déclarée en dernier) -------------


@router.get(
    "/{id_abonnement}",
    response_model=AbonnementRead,
    summary="Obtenir un de ses abonnements",
)
def obtenir(
    id_abonnement: int, client: ClientConnecte, db: SessionBase
) -> AbonnementRead:
    """**404 — et non 403** — sur l'abonnement d'une autre entreprise."""
    return AbonnementRead.model_validate(
        AbonnementService(db).obtenir_du_client_entreprise(id_abonnement, client)
    )
