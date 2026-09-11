"""Endpoints de LOGEMENT.

**Lectures publiques, écritures réservées aux administrateurs** — même réglage
que `SALLE` et que les catalogues produit et formation.

Le filtre par statut ne dit **rien** de la disponibilité à une date donnée : il
retient les logements dont l'état le permet. Savoir si l'un d'eux est déjà
réservé sur une période relève des `RESERVATION` (#47).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.models.logement import StatutLogement
from app.schemas.logement import (
    LogementAdministrationRead,
    LogementCreate,
    LogementRead,
    LogementUpdate,
)
from app.services.avis_service import AvisService
from app.services.logement_service import LogementService

router = APIRouter(prefix="/logements", tags=["logement"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[LogementRead], summary="Lister les logements")
def lister(
    db: SessionBase,
    statut: Annotated[
        StatutLogement | None,
        Query(description="Filtre par état du bien, pas par occupation."),
    ] = None,
    capacite_minimale: Annotated[
        int | None,
        Query(gt=0, description="Ne retient que les logements d'au moins N places."),
    ] = None,
) -> list[LogementRead]:
    """Catalogue des logements. Public.

    Une combinaison de filtres qu'aucun logement ne satisfait donne une liste
    vide, pas un 404 : ce sont des critères de recherche.
    """
    logements = LogementService(db).lister(statut, capacite_minimale)
    return [LogementRead.model_validate(item) for item in logements]


@router.get(
    "/administration",
    response_model=list[LogementAdministrationRead],
    summary="Lister les logements pour l'administration, archives comprises",
)
def lister_pour_administration(
    admin: PersonnelAdministrateur, db: SessionBase
) -> list[LogementAdministrationRead]:
    """Tous les logements, actifs **et** archivés. Réservé aux administrateurs.

    **Déclarée avant `/{id_logement}`, et l'ordre n'est pas cosmétique** : la
    route paramétrée capterait `administration` pour l'interpréter comme un
    identifiant. Même précaution que `GET /produits/administration`.
    """
    logements = LogementService(db).lister_pour_administration()
    return [LogementAdministrationRead.model_validate(item) for item in logements]


@router.get(
    "/{id_logement}", response_model=LogementRead, summary="Obtenir un logement"
)
def obtenir(id_logement: int, db: SessionBase) -> LogementRead:
    """404 si le logement désigné par l'URL n'existe pas ou est archivé.

    `note_moyenne`/`nombre_avis` sont calculés ici, sur la fiche — pas sur la
    liste, qui n'est pas paginée : cf. `docs/roadmap.md`, 8.3.
    """
    logement = LogementService(db).obtenir(id_logement)
    moyenne = AvisService(db).moyenne_par_logement(id_logement)
    lecture = LogementRead.model_validate(logement)
    return lecture.model_copy(
        update={"note_moyenne": moyenne.moyenne, "nombre_avis": moyenne.nombre}
    )


@router.post(
    "",
    response_model=LogementRead,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un logement",
)
def creer(
    donnees: LogementCreate, admin: PersonnelAdministrateur, db: SessionBase
) -> LogementRead:
    """Le logement naît `Disponible`. Réservé aux administrateurs.

    Le statut n'est pas accepté à la création : le poser en maintenance est une
    décision explicite, prise ensuite.
    """
    return LogementRead.model_validate(LogementService(db).creer(donnees))


@router.put(
    "/{id_logement}", response_model=LogementRead, summary="Modifier un logement"
)
def modifier(
    id_logement: int,
    donnees: LogementUpdate,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> LogementRead:
    """Mise à jour partielle, statut compris."""
    return LogementRead.model_validate(
        LogementService(db).modifier(id_logement, donnees)
    )


@router.delete(
    "/{id_logement}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver un logement",
)
def supprimer(
    id_logement: int, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    """Archive la ligne. Aucun `DELETE` SQL n'est émis.

    409 si des réservations **actives** visent encore le logement.

    À ne pas confondre avec le statut `Hors_service` : archiver retire la ligne
    des lectures, le statut dit que le bien existe mais n'est pas louable.
    """
    LogementService(db).supprimer(id_logement)


@router.post(
    "/{id_logement}/restauration",
    response_model=LogementRead,
    summary="Restaurer un logement archivé",
)
def restaurer(
    id_logement: int, admin: PersonnelAdministrateur, db: SessionBase
) -> LogementRead:
    """Réactive une ligne archivée. Idempotent."""
    return LogementRead.model_validate(LogementService(db).restaurer(id_logement))
