"""Service métier de SESSION_FORMATION."""

from collections.abc import Sequence
from datetime import date

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.core.integrite import viole_contrainte
from app.models.personnel import FonctionPersonnel
from app.models.session_formation import SessionFormation, StatutSessionFormation
from app.repositories.formation_repository import FormationRepository
from app.repositories.session_formation_repository import SessionFormationRepository
from app.schemas.session_formation import (
    SessionFormationCreate,
    SessionFormationUpdate,
)
from app.services.personnel_service import PersonnelService

CONTRAINTE_SESSION_FORMATION = "fk_session_formation_id_formation_formation"

#: Statuts au-delà desquels une session ne bouge plus.
STATUTS_TERMINAUX: frozenset[StatutSessionFormation] = frozenset(
    {StatutSessionFormation.TERMINEE, StatutSessionFormation.ANNULEE}
)


class SessionFormationService:
    """Cycle de vie d'une session : création, affectation, statut."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.sessions = SessionFormationRepository(db)
        self.formations = FormationRepository(db)
        self.personnels = PersonnelService(db)

    # --- Lecture --------------------------------------------------------------

    def obtenir(self, id_session: int) -> SessionFormation:
        """Retourne une session, ou lève `RessourceIntrouvable` (404)."""
        session = self.sessions.get_by_id(id_session)
        if session is None:
            raise RessourceIntrouvable("Session de formation introuvable.")
        return session

    def lister(
        self,
        id_formation: int | None = None,
        statut: StatutSessionFormation | None = None,
    ) -> Sequence[SessionFormation]:
        """Retourne les sessions, filtrées par formation ou par statut.

        Une formation inexistante donne une liste vide plutôt qu'une erreur :
        c'est un critère de recherche, pas une ressource désignée par l'URL.
        """
        if id_formation is not None:
            return self.sessions.lister_par_formation(id_formation)
        return self.sessions.lister_par_statut(statut)

    # --- Création -------------------------------------------------------------

    def creer(self, donnees: SessionFormationCreate) -> SessionFormation:
        """Ouvre une session sur une formation existante.

        `places_restantes` est initialisé depuis `FORMATION.capacite_max` **par
        le serveur** : l'accepter depuis la requête permettrait d'ouvrir une
        session à mille places sur une formation qui en compte douze. Même
        raison que `montant_total` et `prix_unitaire_applique`.

        Le statut naît `Planifiee` — la session existe, elle n'accepte pas
        encore de réservation. L'ouvrir est une décision explicite.

        Le formateur est facultatif ici : une session se planifie souvent avant
        qu'un formateur ne soit désigné. Quand il est fourni, sa fonction est
        vérifiée comme à l'affectation.
        """
        formation = self.formations.get_by_id(donnees.id_formation)
        if formation is None:
            raise ReferenceInvalide(
                f"Aucune formation ne porte l'identifiant {donnees.id_formation}."
            )

        id_formateur = None
        if donnees.id_formateur is not None:
            id_formateur = self._formateur(donnees.id_formateur).id_personnel

        try:
            session = self.sessions.create(
                {
                    "date_debut": donnees.date_debut,
                    "date_fin": donnees.date_fin,
                    "id_formation": formation.id_formation,
                    "id_formateur": id_formateur,
                    "places_restantes": formation.capacite_max,
                    "statut": StatutSessionFormation.PLANIFIEE,
                }
            )
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_SESSION_FORMATION):
                raise ReferenceInvalide(
                    f"Aucune formation ne porte l'identifiant "
                    f"{donnees.id_formation}."
                ) from erreur
            raise
        return session

    # --- Modification ---------------------------------------------------------

    def modifier(
        self, id_session: int, donnees: SessionFormationUpdate
    ) -> SessionFormation:
        """Met à jour une session non terminée.

        La cohérence des dates est vérifiée **ici** et non dans le schema : une
        mise à jour partielle ne porte souvent qu'une des deux dates, l'autre
        étant en base. Le schema, qui ne voit que les champs envoyés, ne peut
        pas en juger — même situation que la cohérence
        `est_personnalisable` / `supplement_personnalisation` en #24.
        """
        session = self.obtenir(id_session)
        self._refuser_si_terminee(session, "modifier la session")
        modifications = donnees.model_dump(exclude_unset=True)

        if (
            "id_formateur" in modifications
            and modifications["id_formateur"] is not None
        ):
            modifications["id_formateur"] = self._formateur(
                modifications["id_formateur"]
            ).id_personnel

        self._verifier_les_dates(session, modifications)

        self.sessions.update(session, modifications)
        self.db.commit()
        return session

    def _verifier_les_dates(
        self, session: SessionFormation, modifications: dict
    ) -> None:
        """Refuse en 422 une session qui se terminerait avant de commencer."""
        debut: date = modifications.get("date_debut", session.date_debut)
        fin: date = modifications.get("date_fin", session.date_fin)
        if fin < debut:
            raise ReferenceInvalide(
                "La date de fin ne peut pas précéder la date de début."
            )

    # --- Affectation ----------------------------------------------------------

    def affecter_formateur(
        self, id_session: int, id_personnel: int
    ) -> SessionFormation:
        """Affecte un formateur à une session.

        La cohérence de fonction est déléguée à
        `PersonnelService.obtenir_avec_fonction`, **la même méthode** que celle
        employée par `LivraisonService.affecter_livreur`.
        `SESSION_FORMATION.#id_formateur` pose exactement le problème de
        `LIVRAISON.#id_personnel` : une clé étrangère qui pointe vers
        `PERSONNEL` tout entier.

        Réaffecter est permis tant que la session n'est pas terminée : un
        formateur peut se désister.
        """
        session = self.obtenir(id_session)
        self._refuser_si_terminee(session, "affecter un formateur")

        session.id_formateur = self._formateur(id_personnel).id_personnel
        self.db.commit()
        return session

    def _formateur(self, id_personnel: int):
        """Raccourci vers le mécanisme partagé, avec la fonction attendue."""
        return self.personnels.obtenir_avec_fonction(
            id_personnel,
            FonctionPersonnel.FORMATEUR,
            pour="une session de formation",
        )

    # --- Statut ---------------------------------------------------------------

    def changer_statut(
        self, id_session: int, statut: StatutSessionFormation
    ) -> SessionFormation:
        """Fait avancer le statut d'une session.

        Deux règles, hors de portée d'un `CHECK` puisqu'elles croisent plusieurs
        colonnes ou l'état antérieur :

        - une session **terminée ne bouge plus**. Rouvrir une session dispensée
          effacerait la trace de ce qui a eu lieu ;
        - passer à `Ouverte` suppose un formateur affecté — on n'ouvre pas les
          inscriptions sur une session que personne n'anime.

        Il n'y a **pas** de statut « Complete » : une session pleine se lit sur
        `places_restantes = 0`. L'inscrire aussi dans le statut créerait deux
        sources pour un même fait, qui divergeraient à la première annulation.
        """
        session = self.obtenir(id_session)
        self._refuser_si_terminee(session, "changer le statut")

        if statut is StatutSessionFormation.OUVERTE and session.id_formateur is None:
            raise ConflitMetier("Aucun formateur n'est affecté à cette session.")

        session.statut = statut
        self.db.commit()
        return session

    def _refuser_si_terminee(self, session: SessionFormation, action: str) -> None:
        """Lève `ConflitMetier` (409) si la session est dans un état terminal.

        409 et non 422 : la charge utile est valide, c'est l'état de la
        ressource qui interdit l'opération.
        """
        if session.statut in STATUTS_TERMINAUX:
            raise ConflitMetier(
                f"Cette session est « {session.statut.value} » : "
                f"impossible de {action}."
            )

    # --- Archivage ------------------------------------------------------------

    def supprimer(self, id_session: int) -> None:
        """Archive une session.

        Aucune propagation vers les réservations : elles n'ont pas encore de
        service (sprint 4, issue suivante). Le refus d'archiver une session
        encore réservée y sera inscrit, avec les couches qui rendent ce comptage
        possible.
        """
        session = self.obtenir(id_session)
        self.sessions.delete(session)
        self.db.commit()
