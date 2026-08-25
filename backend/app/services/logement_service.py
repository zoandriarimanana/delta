"""Service métier de LOGEMENT."""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, RessourceIntrouvable
from app.models.logement import Logement, StatutLogement
from app.models.reservation import StatutReservation
from app.repositories.logement_repository import LogementRepository
from app.repositories.reservation_repository import ReservationRepository
from app.schemas.logement import LogementCreate, LogementUpdate

MESSAGE_ENCORE_RESERVE = "Ce logement porte encore des réservations actives."


class LogementService:
    """Règles de gestion des logements proposés à la nuitée."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.logements = LogementRepository(db)
        self.reservations = ReservationRepository(db)

    def lister(
        self,
        statut: StatutLogement | None = None,
        capacite_minimale: int | None = None,
    ) -> Sequence[Logement]:
        """Retourne les logements, filtrés par état et par capacité.

        **Ne dit rien de la disponibilité à une date donnée.** Un logement
        `Disponible` peut très bien être réservé la semaine prochaine : savoir
        s'il est libre sur une période relève des `RESERVATION` (#47), pas de
        son statut.
        """
        return self.logements.rechercher(statut, capacite_minimale)

    def obtenir(self, id_logement: int) -> Logement:
        """Retourne un logement, ou lève `RessourceIntrouvable` (404)."""
        logement = self.logements.get_by_id(id_logement)
        if logement is None:
            raise RessourceIntrouvable("Logement introuvable.")
        return logement

    def creer(self, donnees: LogementCreate) -> Logement:
        """Crée un logement, `Disponible` par défaut.

        Le statut n'est pas accepté depuis la requête : un logement qu'on ajoute
        au catalogue est en principe louable, et le passer en maintenance est
        une décision explicite prise ensuite.
        """
        logement = self.logements.create(
            {**donnees.model_dump(), "statut": StatutLogement.DISPONIBLE}
        )
        self.db.commit()
        return logement

    def modifier(self, id_logement: int, donnees: LogementUpdate) -> Logement:
        """Met à jour un logement, statut compris.

        Changer l'état d'un bien — le mettre en maintenance, le retirer de
        l'offre — est précisément ce qu'un administrateur fait au fil du temps.
        Aucune règle ne s'y oppose : contrairement au statut d'une réservation,
        celui d'un logement n'a pas de sens de marche et n'engage aucun compteur.
        """
        logement = self.obtenir(id_logement)
        self.logements.update(logement, donnees.model_dump(exclude_unset=True))
        self.db.commit()
        return logement

    def supprimer(self, id_logement: int) -> None:
        """Archive un logement, sauf si des réservations actives le visent.

        **Le comptage exclut les réservations annulées** : elles ne le retiennent
        plus. Sans ce filtre, un logement dont toutes les réservations ont été
        annulées deviendrait inarchivable à jamais — même défaut qu'évité sur
        `SALLE` en #45 et sur les domaines de formation en #34.

        À ne pas confondre avec `Hors_service` : archiver retire la ligne des
        lectures, le statut dit que le bien existe mais n'est pas louable. Un
        logement en travaux reste au catalogue de gestion.
        """
        logement = self.obtenir(id_logement)
        actives = [
            reservation
            for reservation in self.reservations.lister_par_logement(id_logement)
            if reservation.statut is not StatutReservation.ANNULEE
        ]
        if actives:
            raise ConflitMetier(MESSAGE_ENCORE_RESERVE)
        self.logements.delete(logement)
        self.db.commit()

    def restaurer(self, id_logement: int) -> Logement:
        """Réactive un logement archivé. Idempotent.

        Aucune unicité ne peut la faire échouer : `LOGEMENT` n'en porte aucune,
        deux chambres pouvant légitimement partager le même `type_chambre`.
        """
        logement = self.logements.get_by_id(id_logement, inclure_supprimes=True)
        if logement is None:
            raise RessourceIntrouvable("Logement introuvable.")
        if logement.supprime_le is None:
            return logement

        self.logements.restaurer(logement)
        self.db.commit()
        return logement
