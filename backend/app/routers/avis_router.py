"""Endpoints de AVIS.

Lecture publique : consulter les avis n'exige aucun compte, exactement comme
le catalogue produit. Création réservée au client connecté, propriétaire de
la cible désignée (cf. `docs/architecture.md`).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ClientConnecte
from app.schemas.avis import AvisCreate, AvisRead
from app.services.avis_service import AvisService

router = APIRouter(prefix="/avis", tags=["avis"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=AvisRead,
    status_code=status.HTTP_201_CREATED,
    summary="Déposer un avis",
)
def creer(donnees: AvisCreate, client: ClientConnecte, db: SessionBase) -> AvisRead:
    """**422** si la cible n'existe pas ou n'appartient pas au client connecté.
    **409** si la cible n'a pas atteint son statut terminal (`Livree`/`Servie`
    pour une commande, `Honoree` pour une réservation), ou si un avis a déjà
    été déposé sur cette cible."""
    return AvisRead.model_validate(AvisService(db).creer(donnees, client))


@router.get(
    "",
    response_model=list[AvisRead],
    summary="Lister les avis",
)
def lister(
    db: SessionBase,
    id_ligne: int | None = None,
    id_reservation: int | None = None,
) -> list[AvisRead]:
    """Sans filtre : tous les avis. `id_ligne` et `id_reservation` filtrent sur
    une cible précise — utile à une fiche produit ou une page de service."""
    service = AvisService(db)
    if id_ligne is not None:
        avis = service.lister_par_ligne(id_ligne)
    elif id_reservation is not None:
        avis = service.lister_par_reservation(id_reservation)
    else:
        avis = service.lister()
    return [AvisRead.model_validate(a) for a in avis]


@router.get(
    "/{id_avis}",
    response_model=AvisRead,
    summary="Obtenir un avis",
)
def obtenir(id_avis: int, db: SessionBase) -> AvisRead:
    return AvisRead.model_validate(AvisService(db).obtenir(id_avis))
