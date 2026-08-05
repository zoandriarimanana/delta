"""Schemas Pydantic de l'entité COMMANDE."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

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
    #: Saisie au tunnel. Sa **présence** demande une livraison ; son absence
    #: signifie retrait. C'est le seul déclencheur : ni le type de commande ni
    #: `PRODUIT.est_livrable` ne décident à la place du client.
    adresse_livraison: str | None = Field(default=None, min_length=1, max_length=500)
    lignes: list[LigneCommandeCreate] = Field(min_length=1)


class CommandeInviteCreate(CommandeCreate):
    """Charge utile d'une commande passée sans compte.

    Endpoint distinct de la commande connectée, et non un `id_client` optionnel :
    un jeton absent ne doit **jamais** faire basculer silencieusement en mode
    invité. Un jeton expiré donnerait alors une commande anonyme au lieu d'un 401,
    et le client ne retrouverait jamais sa commande dans son historique.

    `contact_invite` est obligatoire ici alors que le `CHECK` de la base ne porte
    que sur `nom_invite` : une commande sans aucun moyen de recontacter
    l'acheteur n'a pas de sens, mais un `CHECK` à trois colonnes se lirait mal
    pour ce qu'il apporte.
    """

    nom_invite: str = Field(min_length=1, max_length=150)
    contact_invite: str = Field(min_length=1, max_length=150)


class CommandeRead(BaseModel):
    """Commande en sortie d'API, lignes incluses."""

    model_config = ConfigDict(from_attributes=True)

    id_commande: int
    #: Horodatage de passation, posé par la base. Exposé parce qu'un client doit
    #: pouvoir lire *quand* il a commandé : un numéro ne le lui dit pas.
    date_commande: datetime
    #: Renseignée uniquement en mode invité. C'est l'unique moyen pour l'invité
    #: de revenir sur sa commande : elle doit lui être présentée à la validation.
    reference_publique: UUID | None = None
    type_commande: TypeCommande
    statut: StatutCommande
    montant_total: Decimal
    id_client: int | None = None
    adresse_livraison: str | None = None
    nom_invite: str | None = None
    contact_invite: str | None = None
    lignes: list[LigneCommandeRead] = []
