"""Repository de l'entité PAIEMENT."""

from datetime import datetime

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

    def existe_reussi_pour_reservation(self, id_reservation: int) -> bool:
        """Même pré-contrôle que `existe_reussi_pour_commande`, pour l'acompte
        d'une réservation (13 octobre 2026). Garantie réelle : l'index
        partiel `uq_paiement_reservation_reussi`."""
        requete = (
            select(Paiement.id_paiement)
            .where(
                Paiement.id_reservation == id_reservation,
                Paiement.statut == StatutPaiement.REUSSI,
                Paiement.supprime_le.is_(None),
            )
            .limit(1)
        )
        return self.db.scalars(requete).first() is not None

    def existe_en_cours_depuis(
        self,
        depuis: datetime,
        *,
        id_commande: int | None = None,
        id_reservation: int | None = None,
    ) -> bool:
        """Indique si un paiement `En_attente` a été initié après `depuis`
        pour cette commande ou cette réservation.

        Sert l'expiration des impayés : un client qui vient d'initier un
        paiement est peut-être en train de le valider sur son téléphone —
        annuler sa commande à ce moment lui ferait payer une commande morte.
        """
        cible = (
            Paiement.id_commande == id_commande
            if id_commande is not None
            else Paiement.id_reservation == id_reservation
        )
        requete = (
            select(Paiement.id_paiement)
            .where(
                cible,
                Paiement.statut == StatutPaiement.EN_ATTENTE,
                Paiement.date_paiement >= depuis,
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
