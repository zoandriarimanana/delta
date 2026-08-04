"""Endpoints de PERSONNEL.

**Toutes les opérations exigent une authentification, lectures comprises** — à
la différence du catalogue produit, dont les lectures sont publiques. Un
annuaire du personnel porte des données personnelles de salariés : nom, adresse
professionnelle, téléphone, date d'embauche. Rien n'y a vocation à être exposé
anonymement.

La barrière est provisoirement `get_current_client`, seule disponible à ce
stade : tout client inscrit passe donc. C'est insuffisant et inscrit comme tel
dans `docs/roadmap.md` ; #23 la remplace par
`get_current_personnel_administrateur`.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ClientConnecte
from app.models.personnel import FonctionPersonnel
from app.schemas.personnel import PersonnelCreate, PersonnelRead, PersonnelUpdate
from app.services.personnel_service import PersonnelService

router = APIRouter(prefix="/personnel", tags=["personnel"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[PersonnelRead], summary="Lister le personnel")
def lister(
    client: ClientConnecte,
    db: SessionBase,
    fonction: Annotated[
        FonctionPersonnel | None,
        Query(description="Filtre par fonction. Absent : tout le personnel."),
    ] = None,
) -> list[PersonnelRead]:
    """Personnel actif, filtrable par fonction.

    Une fonction sans titulaire donne une liste vide, pas un 404 : le paramètre
    est un critère de recherche, pas la désignation d'une ressource. Une valeur
    hors domaine est refusée en 422 par FastAPI, l'énumération faisant foi.
    """
    personnels = PersonnelService(db).lister(fonction)
    return [PersonnelRead.model_validate(p) for p in personnels]


@router.get(
    "/{id_personnel}",
    response_model=PersonnelRead,
    summary="Obtenir un membre du personnel",
)
def obtenir(
    id_personnel: int, client: ClientConnecte, db: SessionBase
) -> PersonnelRead:
    """404 si l'identifiant de l'URL ne désigne personne, ou une ligne archivée."""
    personnel = PersonnelService(db).obtenir(id_personnel)
    return PersonnelRead.model_validate(personnel)


@router.post(
    "",
    response_model=PersonnelRead,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un membre du personnel",
)
def creer(
    donnees: PersonnelCreate, client: ClientConnecte, db: SessionBase
) -> PersonnelRead:
    """409 si l'adresse professionnelle est déjà prise par une ligne active."""
    personnel = PersonnelService(db).creer(donnees)
    return PersonnelRead.model_validate(personnel)


@router.put(
    "/{id_personnel}",
    response_model=PersonnelRead,
    summary="Modifier un membre du personnel",
)
def modifier(
    id_personnel: int,
    donnees: PersonnelUpdate,
    client: ClientConnecte,
    db: SessionBase,
) -> PersonnelRead:
    """Mise à jour partielle : seuls les champs fournis sont écrits."""
    personnel = PersonnelService(db).modifier(id_personnel, donnees)
    return PersonnelRead.model_validate(personnel)


@router.delete(
    "/{id_personnel}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver un membre du personnel",
)
def supprimer(id_personnel: int, client: ClientConnecte, db: SessionBase) -> None:
    """Archive la ligne. Aucun `DELETE` SQL n'est émis.

    Les livraisons et sessions de formation qui la référencent sont conservées
    telles quelles : une livraison passée reste un fait après le départ du
    livreur.
    """
    PersonnelService(db).supprimer(id_personnel)


@router.post(
    "/{id_personnel}/restauration",
    response_model=PersonnelRead,
    summary="Restaurer un membre du personnel archivé",
)
def restaurer(
    id_personnel: int, client: ClientConnecte, db: SessionBase
) -> PersonnelRead:
    """Réactive une ligne archivée — le retour d'un salarié.

    409 si l'adresse professionnelle a été réattribuée entre-temps : l'index
    unique étant partiel, la valeur a pu être reprise par une ligne active.
    """
    personnel = PersonnelService(db).restaurer(id_personnel)
    return PersonnelRead.model_validate(personnel)
