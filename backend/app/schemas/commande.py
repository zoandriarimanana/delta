"""Schemas Pydantic de l'entité COMMANDE."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    #: Réservation de table dont la commande découle, `None` sinon — ce qui
    #: reste le cas courant : on commande le plus souvent sans avoir réservé.
    #:
    #: Le service vérifie qu'elle existe, qu'elle appartient bien à l'acheteur
    #: et qu'elle est dans un statut qui l'autorise. Ces trois règles croisent
    #: la base et ne peuvent pas vivre ici.
    id_reservation: int | None = None
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

    @model_validator(mode="after")
    def _refuser_une_reservation(self) -> "CommandeInviteCreate":
        """Un invité ne peut pas rattacher sa commande à une réservation.

        `RESERVATION.#id_client` est **NOT NULL** : réserver exige un compte,
        contrairement à commander. Une réservation appartient donc toujours à
        quelqu'un, et un invité n'est personne au sens de la base — il ne peut
        pas en être le titulaire.

        Le refus vit ici et non dans le service : la règle ne regarde que la
        charge utile, et la trancher avant la base évite une vérification de
        propriété qui n'aurait aucun propriétaire à comparer.
        """
        if self.id_reservation is not None:
            raise ValueError(
                "Une commande passée sans compte ne peut pas être rattachée "
                "à une réservation."
            )
        return self


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
    #: Réservation dont la commande découle, `None` dans le cas courant.
    id_reservation: int | None = None
    lignes: list[LigneCommandeRead] = []


class CommandePersonnelCreate(CommandeCreate):
    """Charge utile d'une commande saisie par un membre du personnel.

    **Deux chemins, mutuellement exclusifs**, et aucune identité acceptée depuis
    la requête.

    1. `id_reservation` fourni — la commande est rattachée à une réservation de
       table, et `id_client` en est **dérivé** par le service. Le salarié ne
       désigne donc jamais l'acheteur : il est déduit d'un fait déjà en base.
    2. `nom_invite` et `contact_invite` fournis — commande invitée classique,
       simplement saisie par un salarié plutôt que par le client.

    Ni `id_client` ni `id_personnel` ne figurent ici, et c'est le cœur du
    montage : **aucune identité ne vient de la requête**. Le premier est déduit
    de la réservation, le second du jeton du salarié. Les accepter permettrait
    de commander au nom d'autrui, ou d'attribuer une commande à un collègue.

    C'est le principe tenu depuis le Sprint 2, que cette classe étend au
    personnel plutôt qu'elle ne l'entame.
    """

    nom_invite: str | None = Field(default=None, min_length=1, max_length=150)
    contact_invite: str | None = Field(default=None, min_length=1, max_length=150)

    @model_validator(mode="after")
    def _exiger_un_seul_chemin(self) -> "CommandePersonnelCreate":
        """Une réservation **ou** une identité invitée, jamais les deux ni aucune.

        Le `CHECK` de la base — `(id_client IS NOT NULL) <> (nom_invite IS NOT
        NULL)` — garantit déjà l'exclusivité côté données. La refuser ici produit
        un message lisible plutôt qu'une erreur d'intégrité, et avant toute
        écriture : même architecture à deux niveaux que l'unicité d'e-mail.

        `contact_invite` sans `nom_invite` est refusé aussi : une commande sans
        moyen de recontacter l'acheteur n'a pas de sens, et le `CHECK` ne porte
        que sur `nom_invite`.
        """
        invite = self.nom_invite is not None
        reservation = self.id_reservation is not None

        if invite and reservation:
            raise ValueError(
                "Une commande rattachée à une réservation ne peut pas être "
                "passée au nom d'un invité : le client est déduit de la "
                "réservation."
            )
        if not invite and not reservation:
            raise ValueError(
                "Indiquer soit une réservation de table, soit le nom et le "
                "contact de l'acheteur."
            )
        if invite and self.contact_invite is None:
            raise ValueError("Un moyen de recontacter l'acheteur est obligatoire.")
        return self
