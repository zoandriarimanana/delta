"""Endpoints de CATEGORIE_PRODUIT.

**Lectures publiques**, **écritures réservées aux administrateurs**
(`PERSONNEL.est_administrateur`).

Jusqu'au sprint 3, ces écritures n'étaient protégées que par une
authentification client : n'importe quel compte inscrit pouvait modifier le
catalogue, faute d'une notion de droits dans le schéma. C'était la dette
« Sprint 1 (CRUD catalogue) », close ici.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.schemas.categorie_produit import (
    CategorieProduitAdministrationRead,
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
    "/administration",
    response_model=list[CategorieProduitAdministrationRead],
    summary="Lister les catégories pour l'administration, archives comprises",
)
def lister_pour_administration(
    admin: PersonnelAdministrateur, db: SessionBase
) -> list[CategorieProduitAdministrationRead]:
    """Toutes les catégories, actives **et** archivées. Réservé aux
    administrateurs.

    Même montage que `GET /produits/administration` : route distincte plutôt
    qu'un paramètre sur la liste publique, et **déclarée avant
    `/{id_categorie}`** — sans quoi la route paramétrée capterait
    `administration` et l'interpréterait comme un identifiant.
    """
    categories = CategorieProduitService(db).lister_pour_administration()
    return [CategorieProduitAdministrationRead.model_validate(c) for c in categories]


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
    donnees: CategorieProduitCreate, admin: PersonnelAdministrateur, db: SessionBase
) -> CategorieProduitRead:
    """409 si le libellé est déjà pris. Réservé aux administrateurs."""
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
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> CategorieProduitRead:
    """Mise à jour partielle. Réservé aux administrateurs."""
    categorie = CategorieProduitService(db).modifier(id_categorie, donnees)
    return CategorieProduitRead.model_validate(categorie)


@router.delete(
    "/{id_categorie}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une catégorie",
)
def supprimer(
    id_categorie: int, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    """409 si des produits référencent encore la catégorie.

    Réservé aux administrateurs.
    """
    CategorieProduitService(db).supprimer(id_categorie)


@router.post(
    "/{id_categorie}/restauration",
    response_model=CategorieProduitRead,
    summary="Restaurer une catégorie archivée",
)
def restaurer(
    id_categorie: int, admin: PersonnelAdministrateur, db: SessionBase
) -> CategorieProduitRead:
    """Réactive une ligne archivée. Idempotent.

    404 si l'identifiant est inconnu. **409** si une catégorie active porte déjà
    ce libellé : l'index unique est partiel, il a donc pu être réattribué
    pendant l'archivage.
    """
    return CategorieProduitRead.model_validate(
        CategorieProduitService(db).restaurer(id_categorie)
    )
