"""Service métier de SALLE."""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.models.reservation import StatutReservation
from app.models.salle import Salle
from app.repositories.reservation_repository import ReservationRepository
from app.repositories.salle_repository import SalleRepository
from app.schemas.salle import SalleCreate, SalleUpdate

MESSAGE_ENCORE_RESERVEE = "Cette salle porte encore des réservations actives."
MESSAGE_SANS_TARIF = (
    "Une salle doit porter au moins un tarif, horaire ou journalier. "
    "Pour une salle gratuite, indiquer 0.00."
)


class SalleService:
    """Règles de gestion des salles louables."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.salles = SalleRepository(db)
        self.reservations = ReservationRepository(db)

    def lister(self, capacite_minimale: int | None = None) -> Sequence[Salle]:
        """Retourne les salles, filtrées par capacité si demandé.

        Une capacité qu'aucune salle n'atteint donne une liste vide plutôt
        qu'une erreur : c'est un critère de recherche, pas une ressource
        désignée par l'URL.
        """
        if capacite_minimale is None:
            return self.salles.list()
        return self.salles.rechercher_par_capacite(capacite_minimale)

    def obtenir(self, id_salle: int) -> Salle:
        """Retourne une salle, ou lève `RessourceIntrouvable` (404)."""
        salle = self.salles.get_by_id(id_salle)
        if salle is None:
            raise RessourceIntrouvable("Salle introuvable.")
        return salle

    def creer(self, donnees: SalleCreate) -> Salle:
        """Crée une salle. Le schema garantit déjà qu'elle porte un tarif."""
        salle = self.salles.create(donnees.model_dump())
        self.db.commit()
        return salle

    def modifier(self, id_salle: int, donnees: SalleUpdate) -> Salle:
        """Met à jour une salle, sans jamais la laisser sans tarif.

        La vérification vit ici et non dans `SalleUpdate` parce qu'elle croise la
        charge utile et l'**état courant** : effacer le tarif horaire d'une salle
        qui porte un tarif journalier est légitime, ce qu'un schema d'entrée ne
        peut pas savoir. Même situation que la cohérence
        `est_personnalisable` / `supplement_personnalisation` en #24.
        """
        salle = self.obtenir(id_salle)
        modifications = donnees.model_dump(exclude_unset=True)

        horaire = modifications.get("tarif_horaire", salle.tarif_horaire)
        journee = modifications.get("tarif_journee", salle.tarif_journee)
        if horaire is None and journee is None:
            raise ReferenceInvalide(MESSAGE_SANS_TARIF)

        self.salles.update(salle, modifications)
        self.db.commit()
        return salle

    def supprimer(self, id_salle: int) -> None:
        """Archive une salle, sauf si des réservations actives la visent.

        **Le comptage exclut les réservations annulées et archivées** : elles ne
        retiennent plus la salle. Sans ce filtre, une salle dont toutes les
        réservations ont été annulées deviendrait inarchivable à jamais — même
        défaut que celui évité sur les domaines de formation en #34.

        L'archivage étant un `UPDATE`, aucun `ON DELETE` du schéma ne se
        déclenche : le refus est entièrement à la charge du service (règle
        transverse de `docs/roadmap.md`).
        """
        salle = self.obtenir(id_salle)
        actives = [
            reservation
            for reservation in self.reservations.lister_par_salle(id_salle)
            if reservation.statut is not StatutReservation.ANNULEE
        ]
        if actives:
            raise ConflitMetier(MESSAGE_ENCORE_RESERVEE)
        self.salles.delete(salle)
        self.db.commit()

    def restaurer(self, id_salle: int) -> Salle:
        """Réactive une salle archivée.

        Sans effet si elle est déjà active : l'opération est idempotente.
        Aucune unicité ne peut la faire échouer — `SALLE` n'en porte aucune,
        contrairement à `DOMAINE_FORMATION.libelle`. Deux salles peuvent
        légitimement porter le même nom sur deux sites.
        """
        salle = self.salles.get_by_id(id_salle, inclure_supprimes=True)
        if salle is None:
            raise RessourceIntrouvable("Salle introuvable.")
        if salle.supprime_le is None:
            return salle

        self.salles.restaurer(salle)
        self.db.commit()
        return salle
