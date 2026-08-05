"""Service métier de COMMANDE."""

from collections.abc import Sequence
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.models.client import Client
from app.models.commande import Commande, StatutCommande
from app.models.ligne_commande import LigneCommande
from app.models.produit import Produit
from app.repositories.commande_repository import CommandeRepository
from app.repositories.demande_personnalisation_repository import (
    DemandePersonnalisationRepository,
)
from app.repositories.ligne_commande_repository import LigneCommandeRepository
from app.repositories.produit_repository import ProduitRepository
from app.schemas.commande import CommandeCreate, CommandeInviteCreate
from app.schemas.ligne_commande import LigneCommandeCreate

#: Supplément appliqué à une demande de personnalisation.
#:
#: Nul, et c'est un manque assumé : le MLD ne porte **aucun tarif** de
#: personnalisation, ni sur `PRODUIT` ni ailleurs. En inventer un ici serait une
#: règle métier sortie de nulle part. La constante existe pour que ce vide porte
#: un nom et un seul point de changement, plutôt que d'être un `0` anonyme perdu
#: dans le calcul.
SUPPLEMENT_PERSONNALISATION = Decimal("0")


class CommandeService:
    """Règles de gestion des commandes.

    Trois invariants portés ici, qu'aucune contrainte de base ne garantit :
    le prix appliqué vient du catalogue, le montant total est calculé par le
    serveur, et le stock ne peut pas devenir négatif.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.commandes = CommandeRepository(db)
        self.lignes = LigneCommandeRepository(db)
        self.produits = ProduitRepository(db)
        self.personnalisations = DemandePersonnalisationRepository(db)

    def obtenir(self, id_commande: int) -> Commande:
        """Retourne une commande, ou lève `RessourceIntrouvable` (404)."""
        commande = self.commandes.get_by_id(id_commande)
        if commande is None:
            raise RessourceIntrouvable("Commande introuvable.")
        return commande

    def obtenir_par_reference(self, reference: UUID) -> Commande:
        """Retourne la commande invitée portant cette référence, ou 404.

        Seul chemin de lecture d'un invité. La référence est un UUID
        précisément pour qu'il ne soit pas énumérable, contrairement à
        l'identifiant séquentiel exposé par `GET /commandes/{id}`.
        """
        commande = self.commandes.get_by_reference_publique(reference)
        if commande is None:
            raise RessourceIntrouvable("Commande introuvable.")
        return commande

    def lister_du_client(self, client: Client) -> Sequence[Commande]:
        """Historique d'un client, les plus récentes d'abord."""
        return self.commandes.lister_par_client(client.id_client)

    def _rattacher_personnalisation(
        self,
        demandee: LigneCommandeCreate,
        produit: Produit,
        ligne: LigneCommande,
    ) -> Decimal:
        """Crée la demande jointe à la ligne, et retourne son supplément.

        Retourne `Decimal("0")` quand aucune personnalisation n'est demandée :
        l'appelant additionne sans se soucier du cas.

        Le supplément **ne vient pas de la requête** : il vaut
        `SUPPLEMENT_PERSONNALISATION`, dont la valeur nulle est un manque assumé
        et documenté. Il est néanmoins additionné plutôt qu'ignoré — le jour où
        un tarif existera, `montant_total` restera juste sans que la forme du
        calcul change.

        `id_produit_base` est déduit du produit de la ligne : le laisser saisir
        ouvrirait une incohérence qu'il faudrait ensuite détecter.
        """
        if demandee.personnalisation is None:
            return Decimal("0")

        self._refuser_produit_non_personnalisable(produit)

        creee = self.personnalisations.create(
            {
                "id_ligne": ligne.id_ligne,
                "id_produit_base": produit.id_produit,
                "supplement_prix": SUPPLEMENT_PERSONNALISATION,
                **demandee.personnalisation.model_dump(),
            }
        )
        return creee.supplement_prix

    def _refuser_produit_non_personnalisable(self, produit: Produit) -> None:
        """Lève `ReferenceInvalide` (422) si le produit n'accepte pas de demande.

        422 et non 409 : la charge utile désigne un produit qui existe, c'est la
        combinaison envoyée qui est invalide — au même titre qu'une quantité
        négative. Le conflit, lui, décrirait un état de la base qui a changé.

        `est_personnalisable` est une propriété du catalogue, pas une préférence
        du client : un pain de mie ne se personnalise pas parce qu'on le demande.
        """
        if not produit.est_personnalisable:
            raise ReferenceInvalide(
                f"Le produit « {produit.nom} » n'accepte pas de personnalisation."
            )

    def _produit_commandable(self, ligne: LigneCommandeCreate) -> Produit:
        """Charge le produit visé, ou lève `ReferenceInvalide` (422).

        422 et non 404 : la référence est dans le corps de la requête, pas dans
        l'URL (cf. `docs/architecture.md`). Un produit archivé est traité comme
        inexistant — `get_by_id` le filtre.
        """
        produit = self.produits.get_by_id(ligne.id_produit)
        if produit is None:
            raise ReferenceInvalide(
                f"Aucun produit ne porte l'identifiant {ligne.id_produit}."
            )
        return produit

    def _reserver_le_stock(self, produit: Produit, quantite: int) -> None:
        """Décrémente le stock, ou lève un conflit.

        Le décrément est un `UPDATE` conditionnel atomique : c'est PostgreSQL
        qui arbitre entre deux commandes simultanées sur le dernier article.

        Zéro ligne touchée recouvre deux causes qu'il faut distinguer pour ne
        pas afficher « stock insuffisant » à propos d'un produit qui vient
        d'être archivé.
        """
        if self.produits.decrementer_stock(produit.id_produit, quantite):
            return

        if self.produits.get_by_id(produit.id_produit) is None:
            raise ReferenceInvalide(
                f"Le produit {produit.id_produit} n'est plus disponible."
            )
        raise ConflitMetier(
            f"Stock insuffisant pour « {produit.nom} » : "
            f"{quantite} demandé(s), {produit.stock_disponible} disponible(s)."
        )

    def creer(self, donnees: CommandeCreate, client: Client) -> Commande:
        """Crée une commande au nom du client authentifié.

        `id_client` vient du jeton, jamais du corps de la requête : l'accepter
        laisserait commander au nom d'autrui.
        """
        return self._creer(donnees, {"id_client": client.id_client})

    def creer_pour_invite(self, donnees: CommandeInviteCreate) -> Commande:
        """Crée une commande sans compte, et lui attribue une référence publique.

        La `reference_publique` est générée **ici et seulement ici** : une
        commande passée par un client identifié n'en a pas besoin, il retrouve la
        sienne par son historique.

        C'est le seul moyen pour l'invité de revenir sur sa commande. Elle doit
        donc lui être présentée à la validation — l'interface en porte la
        responsabilité (issue #15).
        """
        return self._creer(
            donnees,
            {
                "nom_invite": donnees.nom_invite,
                "contact_invite": donnees.contact_invite,
                "reference_publique": uuid4(),
            },
        )

    def _creer(
        self, donnees: CommandeCreate, identification: dict[str, Any]
    ) -> Commande:
        """Crée une commande et ses lignes en une seule transaction.

        `identification` porte ce qui distingue les deux parcours — soit
        `id_client`, soit le couple invité et sa référence. Le reste est commun,
        et le `CHECK` de la base garantit qu'on ne fournit jamais les deux.

        Ce que le serveur impose, et n'accepte donc pas depuis la requête :

        - `prix_unitaire_applique` est **recopié du catalogue** au moment de la
          commande. Il est ensuite figé : une évolution ultérieure de
          `PRODUIT.prix_unitaire` ne rétroagit pas sur les commandes passées.
        - `montant_total` est la somme des lignes, calculée ici. L'accepter du
          client reviendrait à le laisser fixer ce qu'il paie.
        - `statut` naît toujours `En_attente` : c'est un cycle de vie, pas une
          donnée d'entrée.

        Le stock est réservé ligne par ligne avant l'écriture. Un échec sur la
        troisième ligne annule les deux premières réservations : tout se joue
        dans la même transaction, le `rollback` du service appelant les défait.
        """
        commande = self.commandes.create(
            {
                "type_commande": donnees.type_commande,
                "statut": StatutCommande.EN_ATTENTE,
                "montant_total": Decimal("0"),
                **identification,
            }
        )

        montant = Decimal("0")
        for ligne in donnees.lignes:
            produit = self._produit_commandable(ligne)
            self._reserver_le_stock(produit, ligne.quantite)
            ligne_creee = self.lignes.create(
                {
                    "id_commande": commande.id_commande,
                    "id_produit": produit.id_produit,
                    "quantite": ligne.quantite,
                    "prix_unitaire_applique": produit.prix_unitaire,
                }
            )
            montant += produit.prix_unitaire * ligne.quantite
            montant += self._rattacher_personnalisation(ligne, produit, ligne_creee)

        commande.montant_total = montant
        self.db.commit()
        return commande

    def supprimer(self, id_commande: int) -> None:
        """Archive une commande **et ses lignes**, dans la même transaction.

        Le schéma prévoit `ON DELETE CASCADE` de `LIGNE_COMMANDE` vers
        `COMMANDE`, et de `DEMANDE_PERSONNALISATION` vers `LIGNE_COMMANDE`, mais
        un archivage est un `UPDATE` : aucune des deux cascades ne se déclenche.
        Propager est une responsabilité de service (règle transverse de
        `docs/roadmap.md`), sur **deux** niveaux et non un seul.

        `montant_total` n'est pas remis à zéro : il reste la trace de ce qui a
        été commandé.
        """
        commande = self.obtenir(id_commande)
        for ligne in self.lignes.lister_par_commande(id_commande):
            personnalisation = self.personnalisations.get_by_ligne(ligne.id_ligne)
            if personnalisation is not None:
                self.personnalisations.delete(personnalisation)
            self.lignes.delete(ligne)
        self.commandes.delete(commande)
        self.db.commit()
