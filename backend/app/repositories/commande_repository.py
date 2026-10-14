"""Repository de l'entité COMMANDE."""

from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select, update

from app.models.commande import Commande, StatutCommande
from app.repositories.base_repository import BaseRepository


class CommandeRepository(BaseRepository[Commande]):
    """CRUD générique, plus la recherche par client et la transition de
    statut conditionnelle."""

    modele = Commande

    def lister_par_client(
        self, id_client: int, inclure_supprimes: bool = False
    ) -> Sequence[Commande]:
        """Retourne les commandes **actives** d'un client, les plus récentes d'abord.

        Le filtre par client vient toujours de l'appelant authentifié, jamais
        d'un paramètre de requête : c'est ce qui garantit qu'un client ne lit pas
        l'historique d'un autre (issue #16).

        Le tri porte sur `date_commande`, pas sur l'identifiant. Ce dernier n'est
        un proxy de la chronologie que tant que la séquence est intacte : une
        reprise de données ou une insertion hors API le fausserait sans que rien
        ne le signale. `id_commande` reste en second critère pour départager deux
        commandes du même instant — sans lui, leur ordre relatif serait laissé au
        moteur, et la pagination deviendrait non déterministe.
        """
        requete = select(Commande).where(Commande.id_client == id_client)
        if not inclure_supprimes:
            requete = requete.where(Commande.supprime_le.is_(None))
        requete = requete.order_by(
            Commande.date_commande.desc(), Commande.id_commande.desc()
        )
        return self.db.scalars(requete).all()

    def lister_recentes(self, inclure_supprimes: bool = False) -> Sequence[Commande]:
        """Toutes les commandes actives, **les plus récentes d'abord** — même
        tri que `lister_par_client`, et pour la même raison : sur
        `date_commande`, l'identifiant ne départageant que deux commandes du
        même instant.

        `list()` triait par identifiant croissant : l'écran d'administration
        ouvrait sur les plus anciennes (demande du 13 octobre 2026).
        """
        requete = select(Commande)
        if not inclure_supprimes:
            requete = requete.where(Commande.supprime_le.is_(None))
        requete = requete.order_by(
            Commande.date_commande.desc(), Commande.id_commande.desc()
        )
        return self.db.scalars(requete).all()

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

    def changer_statut_si(
        self,
        id_commande: int,
        attendu: StatutCommande,
        nouveau: StatutCommande,
    ) -> bool:
        """Passe la commande à `nouveau` **seulement** si elle est encore à
        `attendu`. `False` si aucune ligne n'a été touchée.

        Un `UPDATE` conditionnel, même patron que le décrément de
        `places_restantes` : deux administrateurs qui font avancer la même
        commande au même instant ne lui font pas sauter deux étapes — le
        second trouve un statut qui a déjà changé.
        """
        resultat = self.db.execute(
            update(Commande)
            .where(
                Commande.id_commande == id_commande,
                Commande.statut == attendu,
                Commande.supprime_le.is_(None),
            )
            .values(statut=nouveau)
            .execution_options(synchronize_session=False)
        )
        return resultat.rowcount == 1

    def totaux(
        self, statuts: Sequence[StatutCommande], depuis: datetime | None
    ) -> tuple[int, Decimal]:
        """Nombre de commandes aux `statuts` donnés et somme de leur
        `montant_total` (frais de livraison compris), depuis `depuis` — tout
        l'historique si `None`. Les commandes archivées comptent : ce sont
        des ventes terminées."""
        requete = select(
            func.count(Commande.id_commande), func.sum(Commande.montant_total)
        ).where(Commande.statut.in_(list(statuts)))
        if depuis is not None:
            requete = requete.where(Commande.date_commande >= depuis)
        nombre, somme = self.db.execute(requete).one()
        return int(nombre), Decimal(somme or 0)

    def compter_actives(self, statut: StatutCommande) -> int:
        """Commandes **actives** (non archivées) à un statut donné."""
        return int(
            self.db.scalar(
                select(func.count(Commande.id_commande)).where(
                    Commande.statut == statut, Commande.supprime_le.is_(None)
                )
            )
            or 0
        )
