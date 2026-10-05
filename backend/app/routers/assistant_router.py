"""Endpoints de l'assistant IA (Sprint 12).

**Questions publiques**, comme le catalogue qu'elles interrogent : un visiteur
pose une question sans compte. Rate limitées (`LIMITE_ASSISTANT`) : chaque
question est un appel facturé. **Administration réservée** :
`PersonnelAdministrateur`, comme toute écriture du catalogue.
"""

import json
from collections.abc import Iterator
from itertools import chain
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PersonnelAdministrateur
from app.core.exceptions import ServiceIndisponible
from app.core.rate_limit import LIMITE_ASSISTANT, limiter
from app.schemas.assistant import (
    DisponibiliteAssistant,
    EtatAssistant,
    QuestionAssistant,
    ReindexationAssistant,
    ReponseAssistant,
)
from app.services.assistant_service import AssistantService

router = APIRouter(prefix="/assistant", tags=["assistant"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.get(
    "/disponibilite",
    response_model=DisponibiliteAssistant,
    summary="Savoir si l'assistant est activé",
)
def disponibilite() -> DisponibiliteAssistant:
    """Public et gratuit : ne contacte aucun fournisseur."""
    return DisponibiliteAssistant(actif=AssistantService.est_actif())


@router.post("/question", response_model=ReponseAssistant, summary="Poser une question")
@limiter.limit(LIMITE_ASSISTANT)
def poser_question(request: Request, donnees: QuestionAssistant) -> ReponseAssistant:
    """Réponse complète. 503 si l'assistant est coupé ou un fournisseur en panne.

    `request: Request` est exigé par `@limiter.limit`.
    """
    return ReponseAssistant.model_validate(
        AssistantService().repondre(donnees.question)
    )


def _evenement_sse(evenement: dict[str, Any]) -> str:
    return f"data: {json.dumps(evenement, ensure_ascii=False)}\n\n"


@router.post("/question/flux", summary="Poser une question, réponse en flux (SSE)")
@limiter.limit(LIMITE_ASSISTANT)
def poser_question_en_flux(
    request: Request, donnees: QuestionAssistant
) -> StreamingResponse:
    """Flux `text/event-stream` : `{"jeton": ...}` répétés, puis
    `{"fin": true, "sources": [...]}`.

    **Le premier événement est calculé avant d'ouvrir le flux** : recherche
    dans l'index et premier jeton. Une panne à ce stade — assistant coupé,
    Hugging Face injoignable — donne donc encore un vrai 503. Une panne
    *pendant* la génération ne peut plus changer le code HTTP déjà envoyé :
    elle est signalée dans le flux par un événement `{"erreur": ...}`.
    """
    evenements = AssistantService().repondre_en_flux(donnees.question)
    premier = next(evenements)

    def flux() -> Iterator[str]:
        try:
            for evenement in chain([premier], evenements):
                yield _evenement_sse(evenement)
        except ServiceIndisponible as erreur:
            yield _evenement_sse({"erreur": str(erreur)})

    return StreamingResponse(
        flux(),
        media_type="text/event-stream",
        # Sans ces en-têtes, un proxy (Render compris) peut mettre le flux en
        # tampon et livrer la réponse d'un bloc, à la fin.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get(
    "/administration/etat",
    response_model=EtatAssistant,
    summary="État de l'assistant et de son index",
)
def etat(_admin: PersonnelAdministrateur) -> EtatAssistant:
    return EtatAssistant.model_validate(AssistantService().etat())


@router.post(
    "/administration/reindexation",
    response_model=ReindexationAssistant,
    summary="Reconstruire tout l'index de l'assistant",
)
def reindexer(
    _admin: PersonnelAdministrateur, db: SessionBase
) -> ReindexationAssistant:
    """Plusieurs dizaines de secondes sur un gros catalogue : un appel
    d'embeddings par fiche. 503 si un fournisseur tombe en cours de route."""
    return ReindexationAssistant.model_validate(AssistantService(db).reindexer())
