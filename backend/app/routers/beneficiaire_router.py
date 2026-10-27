"""Endpoints de BENEFICIAIRE.

Même schéma que ABONNEMENT : un client entreprise gère les bénéficiaires de
ses propres abonnements, un administrateur gère tous les bénéficiaires.

**L'ordre de déclaration est significatif.** Les routes `/administration` et
`/administration/{id_beneficiaire}` sont déclarées avant `/{id_beneficiaire}` :
sinon, la route paramétrée du client capterait `administration` comme un
identifiant et FastAPI y répondrait 422 au lieu d'atteindre la bonne route.
Même piège que documenté pour `/produits/administration` (PR #90).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ClientConnecte, PersonnelAdministrateur
from app.schemas.beneficiaire import (
    BeneficiaireCreate,
    BeneficiaireRead,
    BeneficiaireUpdate,
)
from app.services.beneficiaire_service import BeneficiaireService

router = APIRouter(prefix="/beneficiaires", tags=["abonnement"])

SessionBase = Annotated[Session, Depends(get_db)]


# --- Client entreprise (routes sans cible, avant toute route paramétrée) ---


@router.post(
    "",
    response_model=BeneficiaireRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter un bénéficiaire à un de ses abonnements",
)
def creer(
    donnees: BeneficiaireCreate, client: ClientConnecte, db: SessionBase
) -> BeneficiaireRead:
    """**404** si `id_abonnement` ne désigne pas un abonnement du client
    connecté. **422** si cet abonnement est archivé ou arrivé à échéance."""
    return BeneficiaireRead.model_validate(
        BeneficiaireService(db).creer(donnees, client)
    )


@router.get(
    "",
    response_model=list[BeneficiaireRead],
    summary="Mes bénéficiaires",
)
def lister(client: ClientConnecte, db: SessionBase) -> list[BeneficiaireRead]:
    """Bénéficiaires de tous les abonnements de l'entreprise cliente connectée."""
    beneficiaires = BeneficiaireService(db).lister_du_client_entreprise(client)
    return [BeneficiaireRead.model_validate(b) for b in beneficiaires]


# --- Administration (segments littéraux : doivent précéder /{id_beneficiaire}) ---


@router.post(
    "/administration",
    response_model=BeneficiaireRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter un bénéficiaire à un abonnement (administration)",
)
def creer_administration(
    donnees: BeneficiaireCreate, admin: PersonnelAdministrateur, db: SessionBase
) -> BeneficiaireRead:
    """**422** si `id_abonnement` ne désigne aucun abonnement, ou s'il est
    archivé ou arrivé à échéance."""
    return BeneficiaireRead.model_validate(
        BeneficiaireService(db).creer_administration(donnees)
    )


@router.get(
    "/administration",
    response_model=list[BeneficiaireRead],
    summary="Lister tous les bénéficiaires",
)
def lister_administration(
    admin: PersonnelAdministrateur,
    db: SessionBase,
    id_abonnement: int | None = None,
) -> list[BeneficiaireRead]:
    """Sans `id_abonnement` : tous les bénéficiaires. Avec : ceux du seul
    abonnement désigné — évite à une fiche abonnement de télécharger
    l'intégralité du fichier client pour n'en garder qu'une poignée."""
    beneficiaires = BeneficiaireService(db).lister(id_abonnement)
    return [BeneficiaireRead.model_validate(b) for b in beneficiaires]


@router.get(
    "/administration/{id_beneficiaire}",
    response_model=BeneficiaireRead,
    summary="Obtenir un bénéficiaire (administration)",
)
def obtenir_administration(
    id_beneficiaire: int, admin: PersonnelAdministrateur, db: SessionBase
) -> BeneficiaireRead:
    return BeneficiaireRead.model_validate(
        BeneficiaireService(db).obtenir(id_beneficiaire)
    )


@router.put(
    "/administration/{id_beneficiaire}",
    response_model=BeneficiaireRead,
    summary="Modifier un bénéficiaire (administration)",
)
def modifier_administration(
    id_beneficiaire: int,
    donnees: BeneficiaireUpdate,
    admin: PersonnelAdministrateur,
    db: SessionBase,
) -> BeneficiaireRead:
    return BeneficiaireRead.model_validate(
        BeneficiaireService(db).modifier(id_beneficiaire, donnees)
    )


@router.delete(
    "/administration/{id_beneficiaire}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver un bénéficiaire (administration)",
)
def supprimer_administration(
    id_beneficiaire: int, admin: PersonnelAdministrateur, db: SessionBase
) -> None:
    BeneficiaireService(db).supprimer(id_beneficiaire)


# --- Client entreprise (route paramétrée, déclarée en dernier) -------------


@router.get(
    "/{id_beneficiaire}",
    response_model=BeneficiaireRead,
    summary="Obtenir un de ses bénéficiaires",
)
def obtenir(
    id_beneficiaire: int, client: ClientConnecte, db: SessionBase
) -> BeneficiaireRead:
    """**404 — et non 403** — sur le bénéficiaire d'une autre entreprise."""
    return BeneficiaireRead.model_validate(
        BeneficiaireService(db).obtenir_du_client_entreprise(id_beneficiaire, client)
    )


@router.put(
    "/{id_beneficiaire}",
    response_model=BeneficiaireRead,
    summary="Modifier un de ses bénéficiaires",
)
def modifier(
    id_beneficiaire: int,
    donnees: BeneficiaireUpdate,
    client: ClientConnecte,
    db: SessionBase,
) -> BeneficiaireRead:
    service = BeneficiaireService(db)
    service.obtenir_du_client_entreprise(id_beneficiaire, client)
    return BeneficiaireRead.model_validate(service.modifier(id_beneficiaire, donnees))


@router.delete(
    "/{id_beneficiaire}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archiver un de ses bénéficiaires",
)
def supprimer(id_beneficiaire: int, client: ClientConnecte, db: SessionBase) -> None:
    service = BeneficiaireService(db)
    service.obtenir_du_client_entreprise(id_beneficiaire, client)
    service.supprimer(id_beneficiaire)
