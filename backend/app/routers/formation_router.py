"""Endpoints de FORMATION.

Mêmes règles d'accès que les domaines : lectures publiques, écritures réservées
aux administrateurs.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.schemas.formation import FormationCreate, FormationRead, FormationUpdate
from app.services.formation_service import FormationService

router = APIRouter(prefix="/formations", tags=["formation"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[FormationRead], summary="Lister les formations")
def lister(
    db: SessionBase,
    id_domaine: Annotated[
        int | None,
        Query(description="Filtre par domaine. Absent : tout le catalogue."),
    ] = None,
) -> list[FormationRead]:
    """Catalogue des formations, filtrable par domaine. Public.

    Un domaine inexistant donne une liste vide, pas un 404 : le paramètre est un
    critère de recherche, pas la désignation d'une ressource.
    """
    formations = FormationService(db).lister(id_domaine)
    return [FormationRead.model_validate(f) for f in formations]


@router.get(
    "/{id_formation}", response_model=FormationRead, summary="Obtenir une formation"
)
def obtenir(id_formation: int, db: SessionBase) -> FormationRead:
    """404 si la formation désignée par l'URL n'existe pas ou est archivée."""
    return FormationRead.model_validate(FormationService(db).obtenir(id_formation))


@router.post(
    "",
    response_model=FormationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une formation",
)
def creer(
    donnees: FormationCreate, admin: PersonnelAdministrateur, db: SessionBase
) -> FormationRead:
    """422 si `id_domaine` ne désigne aucun domaine.

    Réservé aux administrateurs.
    """
    return FormationRead.model_validate(FormationService(db).creer(donnees))


@router.put(
    "/{id_formation}", response_model=FormationRead, summary="Modifier une formation"
)
def modifier(
    id_formation: int,
    donnees: FormationUpdate,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> FormationRead:
    """Mise à jour partielle : seuls les champs fournis sont écrits."""
    return FormationRead.model_validate(
        FormationService(db).modifier(id_formation, donnees)
    )


@router.delete(
    "/{id_formation}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver une formation",
)
def supprimer(
    id_formation: int, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    """Archive la ligne. Aucun `DELETE` SQL n'est émis."""
    FormationService(db).supprimer(id_formation)
