"""Repository de l'entité AVIS."""

from collections.abc import Sequence
from decimal import Decimal
from typing import NamedTuple

from sqlalchemy import Select, func, select
from sqlalchemy.sql import ColumnExpressionArgument

from app.models.avis import Avis
from app.models.ligne_commande import LigneCommande
from app.models.reservation import Reservation
from app.models.session_formation import SessionFormation
from app.repositories.base_repository import BaseRepository


class MoyenneNotes(NamedTuple):
    """Résultat d'une agrégation de notes sur une cible.

    `moyenne` est `None` — jamais `0` — tant qu'aucun avis actif n'existe :
    `0` serait une note valide (`AVIS.note` va de 1 à 5, mais la moyenne d'un
    ensemble vide n'en est pas une). `nombre` accompagne toujours `moyenne`,
    y compris à `0` : c'est ce qui distingue une moyenne fiable d'une moyenne
    sur un seul avis, cf. `docs/roadmap.md`.
    """

    moyenne: Decimal | None
    nombre: int


class AvisRepository(BaseRepository[Avis]):
    """CRUD générique, plus les recherches par cible et l'agrégation des
    notes moyennes (8.3 — cf. `docs/roadmap.md`).

    Calculée à la demande et jamais stockée, même principe que
    `ConsommationRepasRepository.total_quantite` pour le solde d'abonnement.
    """

    modele = Avis

    def par_ligne(self, id_ligne: int) -> Sequence[Avis]:
        """Avis actifs portant sur une ligne de commande donnée."""
        requete = select(Avis).where(
            Avis.id_ligne == id_ligne, Avis.supprime_le.is_(None)
        )
        return self.db.scalars(requete.order_by(Avis.date_avis.desc())).all()

    def par_reservation(self, id_reservation: int) -> Sequence[Avis]:
        """Avis actifs portant sur une réservation donnée."""
        requete = select(Avis).where(
            Avis.id_reservation == id_reservation, Avis.supprime_le.is_(None)
        )
        return self.db.scalars(requete.order_by(Avis.date_avis.desc())).all()

    def moyenne_par_produit(self, id_produit: int) -> MoyenneNotes:
        """Moyenne des avis « Produit » actifs, tous acheteurs confondus.

        La cible n'est pas portée directement par `AVIS` : la jointure passe
        par `LIGNE_COMMANDE.id_produit`, seule table qui la connaisse.
        """
        requete = (
            select(func.avg(Avis.note), func.count(Avis.id_avis))
            .join(LigneCommande, Avis.id_ligne == LigneCommande.id_ligne)
            .where(LigneCommande.id_produit == id_produit, Avis.supprime_le.is_(None))
        )
        return self._executer(requete)

    def moyenne_par_salle(self, id_salle: int) -> MoyenneNotes:
        """Moyenne des avis « Service » actifs portant sur une salle."""
        return self._moyenne_par_reservation(Reservation.id_salle == id_salle)

    def moyenne_par_logement(self, id_logement: int) -> MoyenneNotes:
        """Moyenne des avis « Service » actifs portant sur un logement."""
        return self._moyenne_par_reservation(Reservation.id_logement == id_logement)

    def moyenne_par_formation(self, id_formation: int) -> MoyenneNotes:
        """Moyenne des avis « Service » actifs portant sur une formation,
        tous acheteurs confondus.

        **Double jointure**, contrairement à `moyenne_par_salle` et
        `moyenne_par_logement` : `RESERVATION` ne porte pas `#id_formation`,
        seulement `#id_session`, et c'est `SESSION_FORMATION` qui porte
        `#id_formation`. Une méthode séparée plutôt qu'un paramètre
        optionnel sur `_moyenne_par_reservation` — forcer une jointure
        conditionnelle dans une méthode générique aurait été moins lisible
        que ces quelques lignes dupliquées.
        """
        requete = (
            select(func.avg(Avis.note), func.count(Avis.id_avis))
            .join(Reservation, Avis.id_reservation == Reservation.id_reservation)
            .join(
                SessionFormation, Reservation.id_session == SessionFormation.id_session
            )
            .where(
                SessionFormation.id_formation == id_formation,
                Avis.supprime_le.is_(None),
            )
        )
        return self._executer(requete)

    def _moyenne_par_reservation(
        self, predicat: ColumnExpressionArgument[bool]
    ) -> MoyenneNotes:
        """Squelette partagé par `moyenne_par_salle` et `moyenne_par_logement` :
        une jointure simple `AVIS` → `RESERVATION`, qui ne suffit pas pour
        `moyenne_par_formation`."""
        requete = (
            select(func.avg(Avis.note), func.count(Avis.id_avis))
            .join(Reservation, Avis.id_reservation == Reservation.id_reservation)
            .where(predicat, Avis.supprime_le.is_(None))
        )
        return self._executer(requete)

    def _executer(self, requete: Select[tuple[Decimal | None, int]]) -> MoyenneNotes:
        moyenne, nombre = self.db.execute(requete).one()
        return MoyenneNotes(moyenne=moyenne, nombre=nombre)
