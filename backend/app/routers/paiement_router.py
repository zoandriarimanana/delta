"""Endpoints de PAIEMENT.

Le webhook de confirmation est **public** — un vrai fournisseur ne porte pas
notre jeton, seule la signature de la requête l'authentifie. L'initiation
(`POST /commandes/{id}/paiements`) vit dans `commande_router.py`, nichée sous
la commande qu'elle concerne (cf. `docs/architecture.md`) ; le webhook, lui,
n'a pas de commande dans son URL — le fournisseur ne connaît que
`reference_externe`, jamais notre `id_commande`.

`simuler_confirmation` (ci-dessous) est le **seul** endroit du code
applicatif où `PasserelleSimulee` est référencée par son nom plutôt que par
le contrat `PasserellePaiement` — délibérément : sa raison d'être est un
comportement propre à la simulation, absent de toute vraie passerelle. Dette
documentée dans `docs/mld.md`, à retirer par le sprint qui branchera un vrai
fournisseur.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ClientConnecte
from app.core.exceptions import AuthentificationInvalide, RessourceIntrouvable
from app.schemas.paiement import PaiementRead, WebhookPaiement
from app.services.paiement_service import PaiementService
from app.services.passerelle_paiement_simulee import PasserelleSimulee

router = APIRouter(prefix="/paiements", tags=["paiement"])

SessionBase = Annotated[Session, Depends(get_db)]

MESSAGE_SIGNATURE_INVALIDE = "Signature de webhook invalide."


@router.post(
    "/webhook",
    response_model=PaiementRead,
    status_code=status.HTTP_200_OK,
    summary="Confirmation d'un paiement (fournisseur)",
)
async def webhook(request: Request, db: SessionBase) -> PaiementRead:
    """Reçoit la confirmation d'un fournisseur — simulé pour ce sprint (cf.
    `docs/mld.md`).

    **La signature est vérifiée avant tout traitement de la charge utile**,
    y compris avant son décodage JSON : un webhook qui traiterait un corps
    non vérifié serait une faille, même en simulation. `verifier_signature`
    vient du contrat `PasserellePaiement` (Sprint 9.2) — ni ce routeur ni le
    service ne savent comment une signature est réellement calculée.

    **401** si la signature est absente ou invalide. **422** si
    `reference_externe` ne désigne aucun paiement.
    """
    service = PaiementService(db)
    charge_utile = await request.body()
    signature = request.headers.get("X-Signature", "")

    if not service.passerelle.verifier_signature(charge_utile, signature):
        raise AuthentificationInvalide(MESSAGE_SIGNATURE_INVALIDE)

    # Validé manuellement, hors du typage de paramètre habituel : FastAPI ne
    # traduit en 422 que les corps déclarés comme paramètre de la route, pas
    # un appel explicite à `model_validate_json`. Sans cette traduction, un
    # corps illisible lèverait une `ValidationError` non gérée — un 500 au
    # lieu du 422 attendu pour une charge utile invalide.
    try:
        corps = WebhookPaiement.model_validate_json(charge_utile)
    except ValidationError as erreur:
        raise RequestValidationError(erreur.errors()) from erreur

    paiement = service.confirmer(corps.reference_externe, corps.statut)
    return PaiementRead.model_validate(paiement)


@router.post(
    "/{id_paiement}/simuler-confirmation",
    response_model=PaiementRead,
    summary="Simule la confirmation d'un paiement (dev uniquement)",
)
def simuler_confirmation(
    id_paiement: int, client: ClientConnecte, db: SessionBase
) -> PaiementRead:
    """Déclenche, depuis l'écran de paiement, la confirmation qu'un vrai
    fournisseur enverrait plus tard par webhook — en attendant les accès
    API réels (cf. `docs/mld.md`). Rejoue le même chemin que le webhook
    (`PaiementService.confirmer`), rien n'est dupliqué.

    **404** — et non 403 — sur le paiement d'un autre client, même
    raisonnement que `suivi_livraison`.

    N'existe que le temps de la simulation : ce endpoint n'a aucun sens une
    fois une vraie passerelle branchée, un vrai fournisseur confirmant de
    lui-même.
    """
    service = PaiementService(db)
    paiement = service.paiements.get_by_id(id_paiement)
    if paiement is None or paiement.commande.id_client != client.id_client:
        raise RessourceIntrouvable("Paiement introuvable.")

    charge_utile, _ = PasserelleSimulee().simuler_confirmation(
        paiement.reference_externe
    )
    corps = WebhookPaiement.model_validate_json(charge_utile)
    resultat = service.confirmer(corps.reference_externe, corps.statut)
    return PaiementRead.model_validate(resultat)
