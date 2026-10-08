"""Endpoints de TAUX_CHANGE.

**Lecture publique** : un visiteur étranger doit voir les prix dans sa
devise avant tout compte. **Écriture réservée aux administrateurs.** Pas de
création ni de suppression : la liste des devises est fermée, ses lignes
sont posées par la migration (cf. `docs/mld.md`).
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.models.taux_change import Devise
from app.schemas.taux_change import TauxChangeRead, TauxChangeUpdate
from app.services.taux_change_service import TauxChangeService

router = APIRouter(prefix="/taux-change", tags=["taux_change"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[TauxChangeRead], summary="Lister les taux")
def lister(db: SessionBase) -> list[TauxChangeRead]:
    """Taux des devises étrangères, en Ariary par unité. Public."""
    return [TauxChangeRead.model_validate(t) for t in TauxChangeService(db).lister()]


@router.put(
    "/{devise}", response_model=TauxChangeRead, summary="Modifier le taux d'une devise"
)
def modifier(
    devise: Devise,
    donnees: TauxChangeUpdate,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> TauxChangeRead:
    """Réservé aux administrateurs. Sans effet sur les commandes passées."""
    return TauxChangeRead.model_validate(
        TauxChangeService(db).modifier(devise, donnees)
    )
