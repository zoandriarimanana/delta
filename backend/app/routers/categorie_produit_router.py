"""Endpoints de CATEGORIE_PRODUIT.

Lectures publiques, écritures réservées aux clients authentifiés — voir la
ligne de dette « Sprint 1 (CRUD catalogue) » dans `docs/roadmap.md` : il ne
s'agit pas d'une restriction administrateur, le schéma n'en porte pas la notion.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ClientConnecte
from app.schemas.categorie_produit import (
    CategorieProduitCreate,
    CategorieProduitRead,
    CategorieProduitUpdate,
)
from app.services.categorie_produit_service import CategorieProduitService

router = APIRouter(prefix="/categories-produit", tags=["catalogue"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get(
    "", response_model=list[CategorieProduitRead], summary="Lister les catégories"
)
def lister(db: SessionBase) -> list[CategorieProduitRead]:
    """Catalogue des catégories. Public."""
    categories = CategorieProduitService(db).lister()
    return [CategorieProduitRead.model_validate(c) for c in categories]


@router.get(
    "/{id_categorie}",
    response_model=CategorieProduitRead,
    summary="Obtenir une catégorie",
)
def obtenir(id_categorie: int, db: SessionBase) -> CategorieProduitRead:
    """404 si la catégorie désignée par l'URL n'existe pas."""
    categorie = CategorieProduitService(db).obtenir(id_categorie)
    return CategorieProduitRead.model_validate(categorie)


@router.post(
    "",
    response_model=CategorieProduitRead,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une catégorie",
)
def creer(
    donnees: CategorieProduitCreate, client: ClientConnecte, db: SessionBase
) -> CategorieProduitRead:
    """409 si le libellé est déjà pris. Authentification requise."""
    categorie = CategorieProduitService(db).creer(donnees)
    return CategorieProduitRead.model_validate(categorie)


@router.put(
    "/{id_categorie}",
    response_model=CategorieProduitRead,
    summary="Modifier une catégorie",
)
def modifier(
    id_categorie: int,
    donnees: CategorieProduitUpdate,
    client: ClientConnecte,
    db: SessionBase,
) -> CategorieProduitRead:
    """Mise à jour partielle. Authentification requise."""
    categorie = CategorieProduitService(db).modifier(id_categorie, donnees)
    return CategorieProduitRead.model_validate(categorie)


@router.delete(
    "/{id_categorie}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une catégorie",
)
def supprimer(id_categorie: int, client: ClientConnecte, db: SessionBase) -> None:
    """409 si des produits référencent encore la catégorie. Authentification requise."""
    CategorieProduitService(db).supprimer(id_categorie)
