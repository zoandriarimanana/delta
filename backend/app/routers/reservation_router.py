"""Endpoints de RESERVATION.

**Toutes les opérations exigent un jeton client.** Une réservation est un
engagement nominatif : il n'y a rien à y lire anonymement, et rien à y écrire au
nom d'autrui.

`id_client` vient toujours du jeton, jamais du corps ni de l'URL. C'est ce qui
garantit qu'un client ne lit ni ne modifie les réservations d'un autre.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ClientConnecte
from app.schemas.reservation import (
    ReservationChangementStatut,
    ReservationCreate,
    ReservationRead,
)
from app.services.reservation_service import ReservationService

router = APIRouter(prefix="/reservations", tags=["reservation"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=ReservationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Réserver une session de formation",
)
def creer(
    donnees: ReservationCreate, client: ClientConnecte, db: SessionBase
) -> ReservationRead:
    """Réserve des places sur une session ouverte.

    **422** si la session n'existe pas, si le type de réservation ne désigne pas
    de session, ou si les dates sont incohérentes. **409** si la session
    n'accepte pas de réservation, ou s'il ne reste pas assez de places — le
    message dit combien il en reste.
    """
    return ReservationRead.model_validate(ReservationService(db).creer(donnees, client))


@router.get("", response_model=list[ReservationRead], summary="Mes réservations")
def lister(client: ClientConnecte, db: SessionBase) -> list[ReservationRead]:
    """Réservations du client connecté, les plus récentes d'abord.

    Le filtre vient du jeton, jamais d'un paramètre : c'est ce qui empêche de
    lire les réservations d'autrui.
    """
    reservations = ReservationService(db).lister_du_client(client)
    return [ReservationRead.model_validate(r) for r in reservations]


@router.get(
    "/{id_reservation}",
    response_model=ReservationRead,
    summary="Obtenir une de ses réservations",
)
def obtenir(
    id_reservation: int, client: ClientConnecte, db: SessionBase
) -> ReservationRead:
    """**404 — et non 403** — sur la réservation d'un autre client : confirmer
    son existence renseignerait déjà."""
    return ReservationRead.model_validate(
        ReservationService(db).obtenir_du_client(id_reservation, client)
    )


@router.put(
    "/{id_reservation}/statut",
    response_model=ReservationRead,
    summary="Changer le statut d'une de ses réservations",
)
def changer_statut(
    id_reservation: int,
    donnees: ReservationChangementStatut,
    client: ClientConnecte,
    db: SessionBase,
) -> ReservationRead:
    """Passer à `Annulee` **restitue les places** à la session.

    **409** si la réservation est déjà annulée : son statut ne peut plus
    changer, faute de quoi il faudrait re-décrémenter et l'opération pourrait
    échouer par manque de places.
    """
    service = ReservationService(db)
    service.obtenir_du_client(id_reservation, client)
    return ReservationRead.model_validate(
        service.changer_statut(id_reservation, donnees.statut)
    )


@router.delete(
    "/{id_reservation}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver une de ses réservations",
)
def supprimer(id_reservation: int, client: ClientConnecte, db: SessionBase) -> None:
    """Archive la ligne **et rend ses places**. Aucun `DELETE` SQL n'est émis."""
    service = ReservationService(db)
    service.obtenir_du_client(id_reservation, client)
    service.supprimer(id_reservation)
