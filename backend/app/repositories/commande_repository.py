"""Repository de l'entité COMMANDE."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select

from app.models.commande import Commande
from app.repositories.base_repository import BaseRepository


class CommandeRepository(BaseRepository[Commande]):
    """CRUD générique, plus la recherche par client."""

    modele = Commande

    def lister_par_client(
        self, id_client: int, inclure_supprimes: bool = False
    ) -> Sequence[Commande]:
        """Retourne les commandes **actives** d'un client, les plus récentes d'abord.

        Le filtre par client vient toujours de l'appelant authentifié, jamais
        d'un paramètre de requête : c'est ce qui garantit qu'un client ne lit pas
        l'historique d'un autre (issue #16).
        """
        requete = select(Commande).where(Commande.id_client == id_client)
        if not inclure_supprimes:
            requete = requete.where(Commande.supprime_le.is_(None))
        return self.db.scalars(requete.order_by(Commande.id_commande.desc())).all()

    def get_by_reference_publique(
        self, reference: UUID, inclure_supprimes: bool = False
    ) -> Commande | None:
        """Retourne la commande invitée portant cette référence, ou None.

        Seul chemin de lecture d'un invité : il n'a pas de compte, donc pas de
        jeton. La contrainte `UNIQUE` garantit au plus une ligne, y compris
        parmi les archivées — un UUID n'est jamais réattribué.
        """
        requete = select(Commande).where(Commande.reference_publique == reference)
        if not inclure_supprimes:
            requete = requete.where(Commande.supprime_le.is_(None))
        return self.db.scalars(requete).one_or_none()
