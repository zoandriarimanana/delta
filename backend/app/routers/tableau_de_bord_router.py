"""Endpoint du tableau de bord de l'administration (14 octobre 2026).

Lecture seule, réservée à `PersonnelAdministrateur` : chiffre d'affaires et
ventes ne regardent que l'administration.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.schemas.tableau_de_bord import Periode, TableauDeBordRead
from app.services.tableau_de_bord_service import TableauDeBordService

router = APIRouter(prefix="/tableau-de-bord", tags=["Tableau de bord"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get(
    "",
    response_model=TableauDeBordRead,
    summary="Chiffres clés et produits les plus vendus",
)
def obtenir(
    admin: PersonnelAdministrateur,
    db: SessionBase,
    periode: Periode = Periode.TRENTE_JOURS,
) -> TableauDeBordRead:
    """Ventes = commandes confirmées, en préparation, livrées ou servies
    (archives comprises) passées sur la période ; 30 jours par défaut."""
    return TableauDeBordService(db).calculer(periode)
