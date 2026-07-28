"""Schemas Pydantic de l'entité COMMANDE."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.commande import StatutCommande, TypeCommande
from app.schemas.ligne_commande import LigneCommandeCreate, LigneCommandeRead


class CommandeCreate(BaseModel):
    """Charge utile de création d'une commande.

    Trois champs du modèle sont volontairement absents :

    - `montant_total` — calculé par le serveur à partir des prix du catalogue.
      L'accepter reviendrait à laisser le client fixer ce qu'il paie.
    - `statut` — toute commande naît `En_attente` ; c'est un cycle de vie, pas
      une donnée d'entrée.
    - `id_client` — déduit du jeton, jamais du corps. Voir issue #14 pour le
      parcours invité.
    """

    type_commande: TypeCommande
    lignes: list[LigneCommandeCreate] = Field(min_length=1)


class CommandeRead(BaseModel):
    """Commande en sortie d'API, lignes incluses."""

    model_config = ConfigDict(from_attributes=True)

    id_commande: int
    type_commande: TypeCommande
    statut: StatutCommande
    montant_total: Decimal
    id_client: int | None = None
    nom_invite: str | None = None
    contact_invite: str | None = None
    lignes: list[LigneCommandeRead] = []
