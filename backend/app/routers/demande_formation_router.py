"""Endpoints de DEMANDE_FORMATION — formation sur commande (14 octobre 2026).

L'envoi est **public**, avec ou sans compte, et débité par IP : un
formulaire ouvert est une cible de spam. Tout le reste est réservé à
l'administration, la demande portant le nom et le contact du demandeur.
`/administration` est déclaré avant la route paramétrée.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ClientOptionnel, PersonnelAdministrateur
from app.core.rate_limit import LIMITE_DEMANDE_FORMATION, limiter
from app.schemas.demande_formation import (
    DemandeFormationAccuse,
    DemandeFormationCreate,
    DemandeFormationRead,
    DemandeFormationSuivi,
)
from app.services.demande_formation_service import DemandeFormationService

router = APIRouter(prefix="/demandes-formation", tags=["Formations sur commande"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=DemandeFormationAccuse,
    status_code=status.HTTP_201_CREATED,
    summary="Demander une formation qui n'est pas au catalogue",
)
@limiter.limit(LIMITE_DEMANDE_FORMATION)
def envoyer(
    request: Request,
    donnees: DemandeFormationCreate,
    client: ClientOptionnel,
    db: SessionBase,
) -> DemandeFormationAccuse:
    """Public. Le client connecté est rattaché d'après sa session.
    `request` est exigé par `@limiter.limit`."""
    demande = DemandeFormationService(db).envoyer(donnees, client)
    return DemandeFormationAccuse.model_validate(demande)


@router.get(
    "/administration",
    response_model=list[DemandeFormationRead],
    summary="Lister les demandes de formation",
)
def lister(
    admin: PersonnelAdministrateur, db: SessionBase
) -> list[DemandeFormationRead]:
    """Les plus récentes d'abord."""
    return [
        DemandeFormationRead.model_validate(d)
        for d in DemandeFormationService(db).lister()
    ]


@router.get(
    "/administration/{id_demande}",
    response_model=DemandeFormationRead,
    summary="Obtenir une demande de formation",
)
def obtenir(
    id_demande: int, admin: PersonnelAdministrateur, db: SessionBase
) -> DemandeFormationRead:
    return DemandeFormationRead.model_validate(
        DemandeFormationService(db).obtenir(id_demande)
    )


@router.put(
    "/administration/{id_demande}",
    response_model=DemandeFormationRead,
    summary="Suivre une demande de formation",
)
def suivre(
    id_demande: int,
    donnees: DemandeFormationSuivi,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> DemandeFormationRead:
    """Pose l'avancement (`Nouvelle`, `En_discussion`, `Planifiee`,
    `Refusee`) et la note interne."""
    return DemandeFormationRead.model_validate(
        DemandeFormationService(db).suivre(id_demande, donnees)
    )


@router.delete(
    "/administration/{id_demande}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver une demande de formation",
)
def archiver(id_demande: int, admin: PersonnelAdministrateur, db: SessionBase) -> None:
    DemandeFormationService(db).archiver(id_demande)
