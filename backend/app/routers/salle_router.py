"""Endpoints de SALLE.

**Lectures publiques, écritures réservées aux administrateurs** — même réglage
que les catalogues produit et formation, et pour la même raison : un visiteur
doit pouvoir consulter les espaces disponibles sans compte, mais les définir
relève de la gestion.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.schemas.salle import SalleCreate, SalleRead, SalleUpdate
from app.services.avis_service import AvisService
from app.services.salle_service import SalleService

router = APIRouter(prefix="/salles", tags=["salle"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[SalleRead], summary="Lister les salles")
def lister(
    db: SessionBase,
    capacite_minimale: Annotated[
        int | None,
        Query(gt=0, description="Ne retient que les salles d'au moins N places."),
    ] = None,
) -> list[SalleRead]:
    """Catalogue des salles, filtrable par capacité. Public.

    Une capacité qu'aucune salle n'atteint donne une liste vide, pas un 404 : le
    paramètre est un critère de recherche, pas la désignation d'une ressource.
    """
    salles = SalleService(db).lister(capacite_minimale)
    return [SalleRead.model_validate(s) for s in salles]


@router.get("/{id_salle}", response_model=SalleRead, summary="Obtenir une salle")
def obtenir(id_salle: int, db: SessionBase) -> SalleRead:
    """404 si la salle désignée par l'URL n'existe pas ou est archivée.

    `note_moyenne`/`nombre_avis` sont calculés ici, sur la fiche — pas sur la
    liste, qui n'est pas paginée : cf. `docs/roadmap.md`, 8.3.
    """
    salle = SalleService(db).obtenir(id_salle)
    moyenne = AvisService(db).moyenne_par_salle(id_salle)
    lecture = SalleRead.model_validate(salle)
    return lecture.model_copy(
        update={"note_moyenne": moyenne.moyenne, "nombre_avis": moyenne.nombre}
    )


@router.post(
    "",
    response_model=SalleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une salle",
)
def creer(
    donnees: SalleCreate, admin: PersonnelAdministrateur, db: SessionBase
) -> SalleRead:
    """422 si la salle ne porte aucun tarif. Réservé aux administrateurs.

    Pour une salle gratuite, indiquer `0.00` : la gratuité est une décision, pas
    une absence.
    """
    return SalleRead.model_validate(SalleService(db).creer(donnees))


@router.put("/{id_salle}", response_model=SalleRead, summary="Modifier une salle")
def modifier(
    id_salle: int,
    donnees: SalleUpdate,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> SalleRead:
    """Mise à jour partielle. 422 si l'opération laisserait la salle sans tarif."""
    return SalleRead.model_validate(SalleService(db).modifier(id_salle, donnees))


@router.delete(
    "/{id_salle}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver une salle",
)
def supprimer(id_salle: int, admin: PersonnelAdministrateur, db: SessionBase) -> None:
    """Archive la ligne. Aucun `DELETE` SQL n'est émis.

    409 si des réservations **actives** visent encore la salle — les
    réservations annulées ne la retiennent plus.
    """
    SalleService(db).supprimer(id_salle)


@router.post(
    "/{id_salle}/restauration",
    response_model=SalleRead,
    summary="Restaurer une salle archivée",
)
def restaurer(
    id_salle: int, admin: PersonnelAdministrateur, db: SessionBase
) -> SalleRead:
    """Réactive une ligne archivée. Idempotent."""
    return SalleRead.model_validate(SalleService(db).restaurer(id_salle))
