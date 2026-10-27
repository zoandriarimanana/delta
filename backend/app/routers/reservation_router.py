"""Endpoints de RESERVATION.

**Deux populations, deux portées** — même patron que `abonnement_router.py` :
un client gère ses propres réservations (`/reservations`), un administrateur
gère toutes les réservations (`/reservations/administration`).

**L'ordre de déclaration est significatif.** `/administration` et
`/administration/{id_reservation}` sont déclarées avant `/{id_reservation}` :
sinon, la route paramétrée du client capterait `administration` comme un
identifiant — même piège que documenté pour `/produits/administration`
(PR #90) et `/abonnements/administration` (Sprint 7).

`id_client` vient toujours du jeton côté client, jamais du corps ni de l'URL.
C'est ce qui garantit qu'un client ne lit ni ne modifie les réservations d'un
autre.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ClientConnecte, PersonnelAdministrateur
from app.schemas.paiement import PaiementCreate, PaiementRead
from app.schemas.reservation import (
    ReservationAnnulation,
    ReservationChangementStatut,
    ReservationCreate,
    ReservationRead,
)
from app.services.paiement_service import PaiementService
from app.services.reservation_service import ReservationService

router = APIRouter(prefix="/reservations", tags=["reservation"])

SessionBase = Annotated[Session, Depends(get_db)]


# --- Client (routes sans cible, avant toute route paramétrée) --------------


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


# --- Administration (segments littéraux : doivent précéder /{id_reservation}) --


@router.get(
    "/administration",
    response_model=list[ReservationRead],
    summary="Lister toutes les réservations",
)
def lister_administration(
    admin: PersonnelAdministrateur,
    db: SessionBase,
    inclure_archives: bool = False,
) -> list[ReservationRead]:
    """Les 4 types confondus (`Formation`, `Salle`, `Logement`, `Table`).
    `inclure_archives` ajoute les réservations archivées, pour les restaurer."""
    reservations = ReservationService(db).lister(inclure_archives=inclure_archives)
    return [ReservationRead.model_validate(r) for r in reservations]


@router.get(
    "/administration/{id_reservation}",
    response_model=ReservationRead,
    summary="Obtenir une réservation (administration)",
)
def obtenir_administration(
    id_reservation: int, admin: PersonnelAdministrateur, db: SessionBase
) -> ReservationRead:
    """404 si l'identifiant ne désigne personne. Une réservation archivée
    reste consultable ici : l'administration la restaure depuis sa fiche."""
    reservation = ReservationService(db).obtenir(id_reservation, inclure_supprimes=True)
    return ReservationRead.model_validate(reservation)


@router.put(
    "/administration/{id_reservation}/statut",
    response_model=ReservationRead,
    summary="Changer le statut d'une réservation (administration)",
)
def changer_statut_administration(
    id_reservation: int,
    donnees: ReservationChangementStatut,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> ReservationRead:
    """Seule route qui accepte `Honoree` — c'est l'administrateur qui constate
    qu'une prestation a eu lieu, pas le client qui la reçoit (cf.
    `ReservationAnnulation`, le seul chemin ouvert côté client).

    **409** si la réservation est déjà annulée : son statut ne peut plus
    changer.
    """
    reservation = ReservationService(db).changer_statut(id_reservation, donnees.statut)
    return ReservationRead.model_validate(reservation)


@router.delete(
    "/administration/{id_reservation}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer (archiver) une réservation honorée ou annulée",
)
def archiver_administration(
    id_reservation: int, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    """Archivage, jamais suppression réelle : la réservation quitte la liste
    mais reste en base, restaurable. **409** si elle est encore en cours."""
    ReservationService(db).archiver(id_reservation)


@router.post(
    "/administration/{id_reservation}/restauration",
    response_model=ReservationRead,
    summary="Restaurer une réservation archivée",
)
def restaurer_administration(
    id_reservation: int, admin: PersonnelAdministrateur, db: SessionBase
) -> ReservationRead:
    """Idempotent. **409** si elle était encore en cours à l'archivage, ou si
    son créneau a été repris entre-temps."""
    reservation = ReservationService(db).restaurer(id_reservation)
    return ReservationRead.model_validate(reservation)


# --- Client (routes paramétrées, déclarées en dernier) ----------------------


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


@router.post(
    "/{id_reservation}/paiements",
    response_model=PaiementRead,
    status_code=status.HTTP_201_CREATED,
    summary="Payer l'acompte d'une de ses réservations",
)
def payer_acompte(
    id_reservation: int,
    donnees: PaiementCreate,
    client: ClientConnecte,
    db: SessionBase,
) -> PaiementRead:
    """Initie le paiement de l'acompte (13 octobre 2026) — mêmes moyens et
    même simulation que le paiement d'une commande. Un acompte réussi
    confirme la réservation.

    **404** sur la réservation d'un autre client ; **409** si elle n'attend
    plus d'acompte ou s'il est déjà payé ; **422** si elle n'en demande pas,
    ou pour un numéro mobile money invalide.
    """
    reservation = ReservationService(db).obtenir_du_client(id_reservation, client)
    paiement = PaiementService(db).initier_acompte(reservation, donnees)
    return PaiementRead.model_validate(paiement)


@router.put(
    "/{id_reservation}/statut",
    response_model=ReservationRead,
    summary="Annuler une de ses réservations",
)
def changer_statut(
    id_reservation: int,
    donnees: ReservationAnnulation,
    client: ClientConnecte,
    db: SessionBase,
) -> ReservationRead:
    """**La seule transition ouverte au client est `Annulee`** — `donnees`
    n'accepte structurellement pas d'autre valeur (cf. `ReservationAnnulation`) :
    un client ne peut pas se déclarer lui-même « servi ».

    L'annulation **restitue les places** à la session. **409** si la
    réservation est déjà annulée : son statut ne peut plus changer, faute de
    quoi il faudrait re-décrémenter et l'opération pourrait échouer par
    manque de places.
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
