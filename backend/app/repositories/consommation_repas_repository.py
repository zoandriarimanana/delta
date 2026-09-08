"""Repository de l'entité CONSOMMATION_REPAS."""

from collections.abc import Sequence

from sqlalchemy import func, select

from app.models.consommation_repas import ConsommationRepas
from app.repositories.base_repository import BaseRepository


class ConsommationRepasRepository(BaseRepository[ConsommationRepas]):
    """CRUD générique, plus les recherches et totaux nécessaires au calcul
    de solde (cf. 7.2 — `ConsommationRepasService.calculer_solde`)."""

    modele = ConsommationRepas

    def par_abonnement(
        self, id_abonnement: int, inclure_supprimes: bool = False
    ) -> Sequence[ConsommationRepas]:
        """Consommations d'un abonnement, les plus récentes d'abord."""
        requete = select(ConsommationRepas).where(
            ConsommationRepas.id_abonnement == id_abonnement
        )
        if not inclure_supprimes:
            requete = requete.where(ConsommationRepas.supprime_le.is_(None))
        requete = requete.order_by(ConsommationRepas.date_consommation.desc())
        return self.db.scalars(requete).all()

    def par_beneficiaire(
        self, id_beneficiaire: int, inclure_supprimes: bool = False
    ) -> Sequence[ConsommationRepas]:
        """Consommations d'un bénéficiaire, les plus récentes d'abord."""
        requete = select(ConsommationRepas).where(
            ConsommationRepas.id_beneficiaire == id_beneficiaire
        )
        if not inclure_supprimes:
            requete = requete.where(ConsommationRepas.supprime_le.is_(None))
        requete = requete.order_by(ConsommationRepas.date_consommation.desc())
        return self.db.scalars(requete).all()

    def total_quantite(self, id_abonnement: int) -> int:
        """Somme des quantités actives consommées sur un abonnement.

        Utilisé par le calcul de solde (7.2) : `nombre_repas_inclus - total`
        pour un abonnement au forfait, `tarif_unitaire_repas * total` pour un
        abonnement à la consommation réelle. `coalesce` évite un `None` sur un
        abonnement sans aucune consommation.
        """
        requete = select(func.coalesce(func.sum(ConsommationRepas.quantite), 0)).where(
            ConsommationRepas.id_abonnement == id_abonnement,
            ConsommationRepas.supprime_le.is_(None),
        )
        return self.db.scalar(requete) or 0
