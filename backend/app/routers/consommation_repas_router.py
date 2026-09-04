"""Endpoints de CONSOMMATION_REPAS.

Trois populations, trois portées :
- **Personnel** (tout salarié connecté, pas seulement l'administrateur) :
  enregistre une consommation. C'est un geste opérationnel — badger un repas
  — pas une décision administrative, même traitement que
  `POST /commandes/personnel`.
- **Client entreprise** : consulte les consommations de ses propres
  abonnements, en lecture seule.
- **Administrateur** : CRUD complet, y compris la correction d'une ligne mal
  saisie.

**L'ordre de déclaration est significatif.** `/administration` et
`/administration/{id_consommation}` précèdent `/{id_consommation}` : sinon,
la route paramétrée du client capterait `administration` comme un
identifiant. Même piège que documenté pour `/produits/administration`
(PR #90) et déjà corrigé une fois sur `/abonnements`.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ClientConnecte, PersonnelAdministrateur, PersonnelConnecte
from app.schemas.consommation_repas import (
    ConsommationRepasCreate,
    ConsommationRepasRead,
    ConsommationRepasUpdate,
)
from app.services.consommation_repas_service import ConsommationRepasService

router = APIRouter(prefix="/consommations", tags=["abonnement"])

SessionBase = Annotated[Session, Depends(get_db)]


# --- Personnel (enregistrement opérationnel) --------------------------------


@router.post(
    "",
    response_model=ConsommationRepasRead,
    status_code=status.HTTP_201_CREATED,
    summary="Enregistrer une consommation",
)
def enregistrer(
    donnees: ConsommationRepasCreate, personnel: PersonnelConnecte, db: SessionBase
) -> ConsommationRepasRead:
    """**422** si `id_abonnement` n'existe pas, si `id_beneficiaire` est
    incohérent avec le `mode_suivi` de l'abonnement, ou si le bénéficiaire
    désigné n'appartient pas à cet abonnement."""
    return ConsommationRepasRead.model_validate(
        ConsommationRepasService(db).enregistrer(donnees)
    )


# --- Client entreprise (lecture seule) --------------------------------------


@router.get(
    "",
    response_model=list[ConsommationRepasRead],
    summary="Mes consommations",
)
def lister(client: ClientConnecte, db: SessionBase) -> list[ConsommationRepasRead]:
    """Consommations de tous les abonnements de l'entreprise cliente connectée."""
    consommations = ConsommationRepasService(db).lister_du_client_entreprise(client)
    return [ConsommationRepasRead.model_validate(c) for c in consommations]


# --- Administration (segments littéraux : avant /{id_consommation}) --------


@router.get(
    "/administration",
    response_model=list[ConsommationRepasRead],
    summary="Lister toutes les consommations",
)
def lister_administration(
    admin: PersonnelAdministrateur, db: SessionBase
) -> list[ConsommationRepasRead]:
    consommations = ConsommationRepasService(db).lister()
    return [ConsommationRepasRead.model_validate(c) for c in consommations]


@router.get(
    "/administration/{id_consommation}",
    response_model=ConsommationRepasRead,
    summary="Obtenir une consommation (administration)",
)
def obtenir_administration(
    id_consommation: int, admin: PersonnelAdministrateur, db: SessionBase
) -> ConsommationRepasRead:
    return ConsommationRepasRead.model_validate(
        ConsommationRepasService(db).obtenir(id_consommation)
    )


@router.put(
    "/administration/{id_consommation}",
    response_model=ConsommationRepasRead,
    summary="Corriger une consommation (administration)",
)
def modifier(
    id_consommation: int,
    donnees: ConsommationRepasUpdate,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> ConsommationRepasRead:
    return ConsommationRepasRead.model_validate(
        ConsommationRepasService(db).modifier(id_consommation, donnees)
    )


@router.delete(
    "/administration/{id_consommation}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver une consommation (administration)",
)
def supprimer(
    id_consommation: int, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    ConsommationRepasService(db).supprimer(id_consommation)


# --- Client entreprise (route paramétrée, déclarée en dernier) -------------


@router.get(
    "/{id_consommation}",
    response_model=ConsommationRepasRead,
    summary="Obtenir une de ses consommations",
)
def obtenir(
    id_consommation: int, client: ClientConnecte, db: SessionBase
) -> ConsommationRepasRead:
    """**404 — et non 403** — sur la consommation d'une autre entreprise."""
    return ConsommationRepasRead.model_validate(
        ConsommationRepasService(db).obtenir_du_client_entreprise(
            id_consommation, client
        )
    )
