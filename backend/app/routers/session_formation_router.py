"""Endpoints de SESSION_FORMATION.

**Lectures publiques, écritures réservées aux administrateurs** — même réglage
que le reste du catalogue de formation : les dates d'une session font partie de
ce qu'un visiteur vient consulter.

Le formateur y est exposé par `FormateurPublic` — nom, prénom et spécialité,
jamais l'adresse professionnelle ni le téléphone.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.models.session_formation import StatutSessionFormation
from app.schemas.session_formation import (
    SessionFormationAffectation,
    SessionFormationChangementStatut,
    SessionFormationCreate,
    SessionFormationRead,
    SessionFormationUpdate,
)
from app.services.session_formation_service import SessionFormationService

router = APIRouter(prefix="/sessions-formation", tags=["formation"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get(
    "", response_model=list[SessionFormationRead], summary="Lister les sessions"
)
def lister(
    db: SessionBase,
    id_formation: Annotated[
        int | None,
        Query(description="Filtre par formation. Absent : toutes les sessions."),
    ] = None,
    statut: Annotated[
        StatutSessionFormation | None, Query(description="Filtre par statut.")
    ] = None,
) -> list[SessionFormationRead]:
    """Sessions de formation, filtrables. Public.

    Une formation inexistante donne une liste vide, pas un 404 : le paramètre
    est un critère de recherche, pas la désignation d'une ressource.
    """
    sessions = SessionFormationService(db).lister(id_formation, statut)
    return [SessionFormationRead.model_validate(s) for s in sessions]


@router.get(
    "/{id_session}", response_model=SessionFormationRead, summary="Obtenir une session"
)
def obtenir(id_session: int, db: SessionBase) -> SessionFormationRead:
    """404 si la session désignée par l'URL n'existe pas ou est archivée."""
    return SessionFormationRead.model_validate(
        SessionFormationService(db).obtenir(id_session)
    )


@router.post(
    "",
    response_model=SessionFormationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ouvrir une session",
)
def creer(
    donnees: SessionFormationCreate, admin: PersonnelAdministrateur, db: SessionBase
) -> SessionFormationRead:
    """422 si `id_formation` ne désigne rien, ou si le formateur fourni n'exerce
    pas la fonction Formateur.

    `places_restantes` est initialisé depuis `FORMATION.capacite_max` par le
    serveur. Réservé aux administrateurs.
    """
    return SessionFormationRead.model_validate(
        SessionFormationService(db).creer(donnees)
    )


@router.put(
    "/{id_session}", response_model=SessionFormationRead, summary="Modifier une session"
)
def modifier(
    id_session: int,
    donnees: SessionFormationUpdate,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> SessionFormationRead:
    """Mise à jour partielle. 409 si la session est déjà terminée."""
    return SessionFormationRead.model_validate(
        SessionFormationService(db).modifier(id_session, donnees)
    )


@router.put(
    "/{id_session}/formateur",
    response_model=SessionFormationRead,
    summary="Affecter un formateur",
)
def affecter_formateur(
    id_session: int,
    donnees: SessionFormationAffectation,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> SessionFormationRead:
    """**422** si le membre du personnel visé n'existe pas ou n'exerce pas la
    fonction Formateur — rien en base ne l'empêche, la clé étrangère pointe vers
    `PERSONNEL` tout entier. **409** si la session est déjà terminée.
    """
    return SessionFormationRead.model_validate(
        SessionFormationService(db).affecter_formateur(id_session, donnees.id_personnel)
    )


@router.put(
    "/{id_session}/statut",
    response_model=SessionFormationRead,
    summary="Changer le statut d'une session",
)
def changer_statut(
    id_session: int,
    donnees: SessionFormationChangementStatut,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> SessionFormationRead:
    """**409** si la session est terminée, ou si l'on tente de l'ouvrir sans
    formateur affecté."""
    return SessionFormationRead.model_validate(
        SessionFormationService(db).changer_statut(id_session, donnees.statut)
    )


@router.delete(
    "/{id_session}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver une session",
)
def supprimer(id_session: int, admin: PersonnelAdministrateur, db: SessionBase) -> None:
    """Archive la ligne. Aucun `DELETE` SQL n'est émis."""
    SessionFormationService(db).supprimer(id_session)
