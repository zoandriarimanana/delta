"""Repository de l'entité LIGNE_COMMANDE."""

from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from typing import NamedTuple

from sqlalchemy import case, func, select

from app.models.commande import Commande, StatutCommande
from app.models.demande_personnalisation import DemandePersonnalisation
from app.models.ligne_commande import LigneCommande
from app.models.produit import Produit
from app.repositories.base_repository import BaseRepository


class VenteProduit(NamedTuple):
    """Ventes cumulées d'un produit sur une période."""

    id_produit: int
    nom: str
    unites_vendues: int
    chiffre_affaires: Decimal
    nombre_commandes: int


class LigneCommandeRepository(BaseRepository[LigneCommande]):
    """CRUD générique, plus la recherche par commande.

    Pas de router associé : une ligne ne se manipule jamais hors de sa commande.
    """

    modele = LigneCommande

    def lister_par_commande(
        self, id_commande: int, inclure_supprimes: bool = False
    ) -> Sequence[LigneCommande]:
        """Retourne les lignes **actives** d'une commande.

        Sert la propagation de l'archivage : archiver une commande archive ses
        lignes, et le `ON DELETE CASCADE` du schéma ne s'en charge pas puisqu'un
        archivage est un `UPDATE`.
        """
        requete = select(LigneCommande).where(LigneCommande.id_commande == id_commande)
        if not inclure_supprimes:
            requete = requete.where(LigneCommande.supprime_le.is_(None))
        return self.db.scalars(requete.order_by(LigneCommande.id_ligne)).all()

    def ventes_par_produit(
        self, statuts: Sequence[StatutCommande], depuis: datetime | None
    ) -> list[VenteProduit]:
        """Ventes cumulées par produit, sur les commandes aux `statuts`
        donnés passées depuis `depuis` (tout l'historique si `None`).

        Les lignes **archivées** comptent : une commande terminée puis
        archivée reste une vente. Une ligne d'un produit vendu à la personne
        compte **un** produit, quel que soit le nombre de personnes — même
        règle que le stock. Le chiffre d'affaires reprend les prix **figés**
        à la commande, supplément de personnalisation compris.
        """
        unites = case(
            (Produit.vendu_par_personne.is_(True), 1), else_=LigneCommande.quantite
        )
        montant = LigneCommande.quantite * (
            LigneCommande.prix_unitaire_applique
            + func.coalesce(DemandePersonnalisation.supplement_prix, 0)
        )
        requete = (
            select(
                Produit.id_produit,
                Produit.nom,
                func.sum(unites),
                func.sum(montant),
                func.count(func.distinct(LigneCommande.id_commande)),
            )
            .join(Commande, Commande.id_commande == LigneCommande.id_commande)
            .join(Produit, Produit.id_produit == LigneCommande.id_produit)
            .outerjoin(
                DemandePersonnalisation,
                DemandePersonnalisation.id_ligne == LigneCommande.id_ligne,
            )
            .where(Commande.statut.in_(list(statuts)))
            .group_by(Produit.id_produit, Produit.nom)
        )
        if depuis is not None:
            requete = requete.where(Commande.date_commande >= depuis)
        return [
            VenteProduit(int(i), nom, int(u or 0), Decimal(m or 0), int(n))
            for i, nom, u, m, n in self.db.execute(requete).all()
        ]
