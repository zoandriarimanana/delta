"""Endpoints de CLIENT_ENTREPRISE, côté administration.

Un seul endpoint, minimal : combler le trou identifié en préparant 7.3
(interface admin abonnements) — aucun moyen pour un administrateur de
désigner une entreprise cliente lors de la création d'un abonnement.

**Route `/administration` distincte, et non un paramètre** : aucune route
publique de listing n'existe pour `CLIENT_ENTREPRISE` à filtrer — même
raisonnement que pour `PRODUIT`/`CATEGORIE_PRODUIT` (PR #90), transposé au cas
où il n'y a pas de route publique du tout à distinguer.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.schemas.client_entreprise import ClientEntrepriseAdministration
from app.services.client_entreprise_service import ClientEntrepriseService

router = APIRouter(prefix="/clients-entreprise", tags=["abonnement"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get(
    "/administration",
    response_model=list[ClientEntrepriseAdministration],
    summary="Lister les entreprises clientes (administration)",
)
def lister_administration(
    admin: PersonnelAdministrateur, db: SessionBase
) -> list[ClientEntrepriseAdministration]:
    """Entreprises actives, pour peupler un sélecteur — ni recherche ni
    pagination : voir la docstring du service."""
    entreprises = ClientEntrepriseService(db).lister()
    return [ClientEntrepriseAdministration.model_validate(e) for e in entreprises]
