"""Endpoints de LIVRAISON.

**Toutes les opérations exigent un jeton de personnel.** Une livraison porte une
adresse de client et l'identité du livreur affecté : rien n'y a vocation à être
lisible anonymement.

Deux niveaux, comme l'annuaire : consulter et faire avancer une tournée relèvent
du travail quotidien d'un salarié ; créer, réaffecter ou archiver relèvent de la
gestion. Le suivi côté client passe par un chemin distinct — voir
`commande_router`, qui expose le statut seul sur la référence publique.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur, PersonnelConnecte
from app.models.livraison import StatutLivraison
from app.schemas.livraison import (
    LivraisonAffectation,
    LivraisonChangementStatut,
    LivraisonPlanification,
    LivraisonRead,
)
from app.services.livraison_service import LivraisonService

router = APIRouter(prefix="/livraisons", tags=["livraison"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[LivraisonRead], summary="Lister les livraisons")
def lister(
    agent: PersonnelConnecte,
    db: SessionBase,
    statut: Annotated[
        StatutLivraison | None,
        Query(description="Filtre par statut. Absent : toutes les livraisons."),
    ] = None,
) -> list[LivraisonRead]:
    """Tableau de bord logistique.

    Un statut sans livraison donne une liste vide, pas un 404 : le paramètre est
    un critère de recherche, pas la désignation d'une ressource.
    """
    livraisons = LivraisonService(db).lister(statut)
    return [LivraisonRead.model_validate(item) for item in livraisons]


@router.get(
    "/{id_livraison}", response_model=LivraisonRead, summary="Obtenir une livraison"
)
def obtenir(
    id_livraison: int, agent: PersonnelConnecte, db: SessionBase
) -> LivraisonRead:
    """404 si la livraison désignée par l'URL n'existe pas ou est archivée."""
    return LivraisonRead.model_validate(LivraisonService(db).obtenir(id_livraison))


@router.put(
    "/{id_livraison}/livreur",
    response_model=LivraisonRead,
    summary="Affecter un livreur",
)
def affecter_livreur(
    id_livraison: int,
    donnees: LivraisonAffectation,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> LivraisonRead:
    """Affecte un livreur. Réservé aux administrateurs.

    **422** si le membre du personnel visé n'existe pas ou n'exerce pas la
    fonction Livreur — rien en base ne l'empêche, la clé étrangère pointe vers
    `PERSONNEL` tout entier. **409** si la livraison est déjà terminée.
    """
    livraison = LivraisonService(db).affecter_livreur(
        id_livraison, donnees.id_personnel
    )
    return LivraisonRead.model_validate(livraison)


@router.put(
    "/{id_livraison}/planification",
    response_model=LivraisonRead,
    summary="Planifier la tournée",
)
def planifier(
    id_livraison: int,
    donnees: LivraisonPlanification,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> LivraisonRead:
    """Pose la date de tournée prévue. Réservé aux administrateurs."""
    livraison = LivraisonService(db).planifier(id_livraison, donnees.date_heure_prevue)
    return LivraisonRead.model_validate(livraison)


@router.put(
    "/{id_livraison}/statut",
    response_model=LivraisonRead,
    summary="Changer le statut d'une livraison",
)
def changer_statut(
    id_livraison: int,
    donnees: LivraisonChangementStatut,
    agent: PersonnelConnecte,
    db: SessionBase,
) -> LivraisonRead:
    """Fait avancer la tournée. Ouvert à tout salarié authentifié.

    C'est le livreur lui-même qui déclare son avancement : le réserver aux
    administrateurs obligerait à passer par un tiers pour dire « je suis parti ».

    **409** si la livraison est déjà terminée, ou si l'on tente de la passer
    `En_cours` sans livreur affecté.
    """
    livraison = LivraisonService(db).changer_statut(id_livraison, donnees.statut)
    return LivraisonRead.model_validate(livraison)


@router.delete(
    "/{id_livraison}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver une livraison",
)
def supprimer(
    id_livraison: int, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    """Archive la ligne. Aucun `DELETE` SQL n'est émis.

    La commande n'est pas touchée : elle reste un fait commercial indépendant de
    la tournée qui devait la porter.
    """
    LivraisonService(db).supprimer(id_livraison)
