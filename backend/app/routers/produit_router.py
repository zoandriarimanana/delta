"""Endpoints de PRODUIT.

Mêmes règles d'accès que les catégories : **lectures publiques** — un
visiteur doit pouvoir parcourir le catalogue sans compte — et **écritures
réservées aux administrateurs**.

Ces écritures étaient jusqu'au sprint 3 ouvertes à tout client inscrit, faute
d'authentification `PERSONNEL` : c'était la dette du Sprint 1, close par
`get_current_personnel_administrateur`.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.schemas.produit import ProduitCreate, ProduitRead, ProduitUpdate
from app.services.produit_service import ProduitService

router = APIRouter(prefix="/produits", tags=["catalogue"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[ProduitRead], summary="Lister les produits")
def lister(
    db: SessionBase,
    id_categorie: Annotated[
        int | None,
        Query(description="Filtre par catégorie. Absent : tout le catalogue."),
    ] = None,
) -> list[ProduitRead]:
    """Catalogue des produits, filtrable par catégorie. Public.

    Une catégorie inexistante donne une liste vide, pas un 404 : le paramètre
    est un critère de recherche, pas la désignation d'une ressource.
    """
    produits = ProduitService(db).lister(id_categorie)
    return [ProduitRead.model_validate(p) for p in produits]


@router.get("/{id_produit}", response_model=ProduitRead, summary="Obtenir un produit")
def obtenir(id_produit: int, db: SessionBase) -> ProduitRead:
    """404 si le produit désigné par l'URL n'existe pas."""
    produit = ProduitService(db).obtenir(id_produit)
    return ProduitRead.model_validate(produit)


@router.post(
    "",
    response_model=ProduitRead,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un produit",
)
def creer(
    donnees: ProduitCreate, admin: PersonnelAdministrateur, db: SessionBase
) -> ProduitRead:
    """422 si `id_categorie` ne désigne aucune catégorie.

    Réservé aux administrateurs.
    """
    produit = ProduitService(db).creer(donnees)
    return ProduitRead.model_validate(produit)


@router.put("/{id_produit}", response_model=ProduitRead, summary="Modifier un produit")
def modifier(
    id_produit: int,
    donnees: ProduitUpdate,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> ProduitRead:
    """Mise à jour partielle, catégorie revalidée si elle change."""
    produit = ProduitService(db).modifier(id_produit, donnees)
    return ProduitRead.model_validate(produit)


@router.delete(
    "/{id_produit}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un produit",
)
def supprimer(id_produit: int, admin: PersonnelAdministrateur, db: SessionBase) -> None:
    """Réservé aux administrateurs."""
    ProduitService(db).supprimer(id_produit)


@router.post(
    "/{id_produit}/restauration",
    response_model=ProduitRead,
    summary="Restaurer un produit archivé",
)
def restaurer(
    id_produit: int, admin: PersonnelAdministrateur, db: SessionBase
) -> ProduitRead:
    """Réactive une ligne archivée. Idempotent.

    404 si l'identifiant est inconnu : la ressource est désignée par l'URL.

    Ne peut pas échouer sur une collision — `PRODUIT` ne porte aucune unicité,
    contrairement à `CATEGORIE_PRODUIT.libelle`.
    """
    return ProduitRead.model_validate(ProduitService(db).restaurer(id_produit))
