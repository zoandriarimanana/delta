"""Endpoints de TARIF_LIVRAISON.

**Lecture publique** : le client doit voir le prix de la livraison sur la
fiche d'un produit, avant tout compte. **Écriture réservée aux
administrateurs.** Pas de création ni de suppression : la ligne unique est
posée par la migration.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.schemas.tarif_livraison import TarifLivraisonRead, TarifLivraisonUpdate
from app.services.tarif_livraison_service import TarifLivraisonService

router = APIRouter(prefix="/tarif-livraison", tags=["tarif_livraison"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get(
    "", response_model=TarifLivraisonRead, summary="Obtenir le tarif de livraison"
)
def obtenir(db: SessionBase) -> TarifLivraisonRead:
    """Forfait et seuil de gratuité. Public."""
    return TarifLivraisonRead.model_validate(TarifLivraisonService(db).obtenir())


@router.put(
    "", response_model=TarifLivraisonRead, summary="Modifier le tarif de livraison"
)
def modifier(
    donnees: TarifLivraisonUpdate, admin: PersonnelAdministrateur, db: SessionBase
) -> TarifLivraisonRead:
    """Réservé aux administrateurs. Sans effet sur les commandes passées."""
    return TarifLivraisonRead.model_validate(
        TarifLivraisonService(db).modifier(donnees)
    )
