"""Endpoints de DOMAINE_FORMATION.

**Lectures publiques, écritures réservées aux administrateurs** — même réglage
que le catalogue produit, et pour la même raison : un visiteur doit pouvoir
parcourir l'offre de formation sans compte, mais la définir relève de la gestion.

Le critère n'est pas « lecture contre écriture » mais la nature de la donnée
(cf. `docs/architecture.md`). Un domaine de formation est une information
commerciale publiée, contrairement à l'annuaire du personnel.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.schemas.domaine_formation import (
    DomaineFormationCreate,
    DomaineFormationRead,
    DomaineFormationUpdate,
)
from app.services.domaine_formation_service import DomaineFormationService

router = APIRouter(prefix="/domaines-formation", tags=["formation"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get(
    "", response_model=list[DomaineFormationRead], summary="Lister les domaines"
)
def lister(db: SessionBase) -> list[DomaineFormationRead]:
    """Domaines de formation. Public."""
    domaines = DomaineFormationService(db).lister()
    return [DomaineFormationRead.model_validate(d) for d in domaines]


@router.get(
    "/{id_domaine}", response_model=DomaineFormationRead, summary="Obtenir un domaine"
)
def obtenir(id_domaine: int, db: SessionBase) -> DomaineFormationRead:
    """404 si le domaine désigné par l'URL n'existe pas ou est archivé."""
    return DomaineFormationRead.model_validate(
        DomaineFormationService(db).obtenir(id_domaine)
    )


@router.post(
    "",
    response_model=DomaineFormationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un domaine",
)
def creer(
    donnees: DomaineFormationCreate, admin: PersonnelAdministrateur, db: SessionBase
) -> DomaineFormationRead:
    """409 si le libellé est déjà pris. Réservé aux administrateurs."""
    return DomaineFormationRead.model_validate(
        DomaineFormationService(db).creer(donnees)
    )


@router.put(
    "/{id_domaine}", response_model=DomaineFormationRead, summary="Modifier un domaine"
)
def modifier(
    id_domaine: int,
    donnees: DomaineFormationUpdate,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> DomaineFormationRead:
    """Mise à jour partielle : seuls les champs fournis sont écrits."""
    return DomaineFormationRead.model_validate(
        DomaineFormationService(db).modifier(id_domaine, donnees)
    )


@router.delete(
    "/{id_domaine}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver un domaine",
)
def supprimer(id_domaine: int, admin: PersonnelAdministrateur, db: SessionBase) -> None:
    """Archive la ligne. Aucun `DELETE` SQL n'est émis.

    409 si le domaine porte encore des formations actives — l'archivage étant un
    `UPDATE`, l'`ON DELETE RESTRICT` du schéma ne se déclenche pas et le refus
    revient au service.
    """
    DomaineFormationService(db).supprimer(id_domaine)


@router.post(
    "/{id_domaine}/restauration",
    response_model=DomaineFormationRead,
    summary="Restaurer un domaine archivé",
)
def restaurer(
    id_domaine: int, admin: PersonnelAdministrateur, db: SessionBase
) -> DomaineFormationRead:
    """Réactive une ligne archivée.

    409 si le libellé a été réattribué entre-temps : l'index unique étant
    partiel, la valeur a pu être reprise par un domaine actif.
    """
    return DomaineFormationRead.model_validate(
        DomaineFormationService(db).restaurer(id_domaine)
    )
