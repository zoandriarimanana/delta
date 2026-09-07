"""Repository de l'entité PAIEMENT."""

from sqlalchemy import select

from app.models.paiement import Paiement, StatutPaiement
from app.repositories.base_repository import BaseRepository


class PaiementRepository(BaseRepository[Paiement]):
    """CRUD générique, plus le pré-contrôle du double paiement et la
    corrélation du webhook."""

    modele = Paiement

    def existe_reussi_pour_commande(self, id_commande: int) -> bool:
        """Indique si la commande porte déjà un paiement `Reussi` actif.

        Pré-contrôle applicatif, appelé à l'**initiation** : refuse d'en
        ouvrir un nouveau si la commande est déjà payée. La garantie réelle
        reste l'index unique partiel `uq_paiement_commande_reussi` (cf.
        `docs/mld.md`), dont la course s'arbitre à la **confirmation**
        (deux webhooks concurrents), pas ici — voir
        `PaiementService.confirmer`.
        """
        requete = (
            select(Paiement.id_paiement)
            .where(
                Paiement.id_commande == id_commande,
                Paiement.statut == StatutPaiement.REUSSI,
                Paiement.supprime_le.is_(None),
            )
            .limit(1)
        )
        return self.db.scalars(requete).first() is not None

    def par_reference_externe(self, reference_externe: str) -> Paiement | None:
        """Retrouve le paiement portant cette référence — clé de corrélation
        du webhook (cf. `docs/mld.md`), jamais `id_paiement` que le
        fournisseur ne connaît pas."""
        requete = select(Paiement).where(
            Paiement.reference_externe == reference_externe,
            Paiement.supprime_le.is_(None),
        )
        return self.db.scalars(requete).first()
