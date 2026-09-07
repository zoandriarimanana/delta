"""Repository de l'entité PAIEMENT."""

from sqlalchemy import select

from app.models.paiement import Paiement, StatutPaiement
from app.repositories.base_repository import BaseRepository


class PaiementRepository(BaseRepository[Paiement]):
    """CRUD générique, plus le pré-contrôle du double paiement."""

    modele = Paiement

    def existe_reussi_pour_commande(self, id_commande: int) -> bool:
        """Indique si la commande porte déjà un paiement `Reussi` actif.

        Pré-contrôle applicatif, pour produire un 409 lisible avant
        d'écrire : la garantie réelle est l'index unique partiel
        `uq_paiement_commande_reussi` (cf. `docs/mld.md`), seul arbitre en
        cas de course entre deux initiations simultanées.
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
