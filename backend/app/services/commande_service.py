"""Service métier de COMMANDE."""

from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.models.client import Client
from app.models.commande import Commande, StatutCommande
from app.models.produit import Produit
from app.repositories.commande_repository import CommandeRepository
from app.repositories.ligne_commande_repository import LigneCommandeRepository
from app.repositories.produit_repository import ProduitRepository
from app.schemas.commande import CommandeCreate
from app.schemas.ligne_commande import LigneCommandeCreate


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

    def obtenir(self, id_commande: int) -> Commande:
        """Retourne une commande, ou lève `RessourceIntrouvable` (404)."""
        commande = self.commandes.get_by_id(id_commande)
        if commande is None:
            raise RessourceIntrouvable("Commande introuvable.")
        return commande

    def lister_du_client(self, client: Client) -> Sequence[Commande]:
        """Historique d'un client, les plus récentes d'abord."""
        return self.commandes.lister_par_client(client.id_client)

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
        """Crée une commande et ses lignes en une seule transaction.

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
                "id_client": client.id_client,
            }
        )

        montant = Decimal("0")
        for ligne in donnees.lignes:
            produit = self._produit_commandable(ligne)
            self._reserver_le_stock(produit, ligne.quantite)
            self.lignes.create(
                {
                    "id_commande": commande.id_commande,
                    "id_produit": produit.id_produit,
                    "quantite": ligne.quantite,
                    "prix_unitaire_applique": produit.prix_unitaire,
                }
            )
            montant += produit.prix_unitaire * ligne.quantite

        commande.montant_total = montant
        self.db.commit()
        return commande

    def supprimer(self, id_commande: int) -> None:
        """Archive une commande **et ses lignes**, dans la même transaction.

        Le schéma prévoit `ON DELETE CASCADE` de `LIGNE_COMMANDE` vers
        `COMMANDE`, mais un archivage est un `UPDATE` : la cascade ne se
        déclenche pas. Propager est une responsabilité de service (règle
        transverse de `docs/roadmap.md`).

        `montant_total` n'est pas remis à zéro : il reste la trace de ce qui a
        été commandé.
        """
        commande = self.obtenir(id_commande)
        for ligne in self.lignes.lister_par_commande(id_commande):
            self.lignes.delete(ligne)
        self.commandes.delete(commande)
        self.db.commit()
