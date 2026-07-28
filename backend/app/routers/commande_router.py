"""Endpoints de COMMANDE.

Deux parcours, deux chemins **distincts** — et non un seul endpoint dont
l'authentification serait optionnelle. Un jeton absent ne doit jamais faire
basculer silencieusement en mode invité : un jeton expiré donnerait alors une
commande anonyme au lieu d'un 401, et le client ne la retrouverait jamais dans
son historique.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ClientConnecte
from app.core.exceptions import RessourceIntrouvable
from app.schemas.commande import CommandeCreate, CommandeInviteCreate, CommandeRead
from app.services.commande_service import CommandeService

router = APIRouter(prefix="/commandes", tags=["commande"])

SessionBase = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=CommandeRead,
    status_code=status.HTTP_201_CREATED,
    summary="Passer une commande",
)
def creer(
    donnees: CommandeCreate, client: ClientConnecte, db: SessionBase
) -> CommandeRead:
    """Crée une commande et ses lignes.

    422 si un produit référencé n'existe pas ou n'est plus disponible, 409 si le
    stock est insuffisant. Le montant et les prix appliqués sont calculés par le
    serveur : les envoyer n'a aucun effet.
    """
    commande = CommandeService(db).creer(donnees, client)
    return CommandeRead.model_validate(commande)


@router.post(
    "/invite",
    response_model=CommandeRead,
    status_code=status.HTTP_201_CREATED,
    summary="Passer une commande sans compte",
)
def creer_pour_invite(donnees: CommandeInviteCreate, db: SessionBase) -> CommandeRead:
    """Crée une commande sans authentification.

    La réponse porte une `reference_publique` : **c'est le seul moyen pour
    l'invité de revenir sur sa commande**, il n'a ni compte ni jeton. L'interface
    doit la lui présenter immédiatement (issue #15).
    """
    commande = CommandeService(db).creer_pour_invite(donnees)
    return CommandeRead.model_validate(commande)


@router.get(
    "/invite/{reference_publique}",
    response_model=CommandeRead,
    summary="Consulter une commande invitée",
)
def obtenir_par_reference(reference_publique: UUID, db: SessionBase) -> CommandeRead:
    """Lecture publique par référence.

    Sans authentification, par construction. La référence est un UUID
    précisément pour n'être pas énumérable : exposer ce chemin sur
    l'identifiant séquentiel laisserait parcourir toutes les commandes.

    Une référence inconnue répond 404, comme une référence appartenant à une
    commande archivée.
    """
    commande = CommandeService(db).obtenir_par_reference(reference_publique)
    return CommandeRead.model_validate(commande)


@router.get("", response_model=list[CommandeRead], summary="Historique du client")
def lister(client: ClientConnecte, db: SessionBase) -> list[CommandeRead]:
    """Commandes du client authentifié, les plus récentes d'abord.

    Le filtre vient du jeton, jamais d'un paramètre : c'est ce qui empêche de
    lire l'historique d'autrui.
    """
    commandes = CommandeService(db).lister_du_client(client)
    return [CommandeRead.model_validate(c) for c in commandes]


@router.get(
    "/{id_commande}", response_model=CommandeRead, summary="Consulter une commande"
)
def obtenir(id_commande: int, client: ClientConnecte, db: SessionBase) -> CommandeRead:
    """Commande du client authentifié.

    La commande d'un autre client répond **404 et non 403** : un 403
    confirmerait son existence à qui essaie des identifiants au hasard.
    """
    commande = CommandeService(db).obtenir(id_commande)
    if commande.id_client != client.id_client:
        raise RessourceIntrouvable("Commande introuvable.")
    return CommandeRead.model_validate(commande)
