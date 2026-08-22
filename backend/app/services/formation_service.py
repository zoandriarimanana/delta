"""Service métier de FORMATION."""

from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ReferenceInvalide, RessourceIntrouvable
from app.core.integrite import viole_contrainte
from app.models.formation import Formation
from app.repositories.domaine_formation_repository import DomaineFormationRepository
from app.repositories.formation_repository import FormationRepository
from app.schemas.formation import FormationCreate, FormationUpdate

CONTRAINTE_FORMATION_DOMAINE = "fk_formation_id_domaine_domaine_formation"


class FormationService:
    """Règles de gestion du catalogue de formation."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.formations = FormationRepository(db)
        self.domaines = DomaineFormationRepository(db)

    def lister(self, id_domaine: int | None = None) -> Sequence[Formation]:
        """Retourne les formations, filtrées par domaine si demandé.

        Sans filtre, retourne tout le catalogue. Un domaine inexistant donne une
        liste vide plutôt qu'une erreur : c'est un critère de recherche, pas une
        ressource désignée par l'URL.
        """
        if id_domaine is None:
            return self.formations.list()
        return self.formations.rechercher_par_domaine(id_domaine)

    def obtenir(self, id_formation: int) -> Formation:
        """Retourne une formation, ou lève `RessourceIntrouvable` (404)."""
        formation = self.formations.get_by_id(id_formation)
        if formation is None:
            raise RessourceIntrouvable("Formation introuvable.")
        return formation

    def _verifier_domaine(self, id_domaine: int) -> None:
        """Lève `ReferenceInvalide` (422) si le domaine visé n'existe pas.

        422 et non 404 : l'URL est valide, c'est le corps de la requête qui ne
        l'est pas (cf. `docs/architecture.md`).
        """
        if self.domaines.get_by_id(id_domaine) is None:
            raise ReferenceInvalide(
                f"Aucun domaine de formation ne porte l'identifiant {id_domaine}."
            )

    def creer(self, donnees: FormationCreate) -> Formation:
        """Crée une formation rattachée à un domaine existant.

        Même double protection qu'ailleurs : le pré-contrôle donne un message
        clair, l'interception de l'`IntegrityError` couvre la course où le
        domaine disparaît entre la vérification et le `commit`.
        """
        self._verifier_domaine(donnees.id_domaine)
        try:
            formation = self.formations.create(donnees.model_dump())
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_FORMATION_DOMAINE):
                raise ReferenceInvalide(
                    f"Aucun domaine de formation ne porte l'identifiant "
                    f"{donnees.id_domaine}."
                ) from erreur
            raise
        return formation

    def modifier(self, id_formation: int, donnees: FormationUpdate) -> Formation:
        """Met à jour une formation, en revalidant le domaine s'il change."""
        formation = self.obtenir(id_formation)
        modifications = donnees.model_dump(exclude_unset=True)

        if "id_domaine" in modifications:
            self._verifier_domaine(modifications["id_domaine"])

        try:
            self.formations.update(formation, modifications)
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_FORMATION_DOMAINE):
                raise ReferenceInvalide(
                    "Le domaine de formation visé n'existe pas."
                ) from erreur
            raise
        return formation

    def supprimer(self, id_formation: int) -> None:
        """Archive une formation.

        **Aucun garde-fou sur les sessions à ce stade**, et ce n'est pas un
        oubli : `SESSION_FORMATION` n'a ni service ni router, aucune session ne
        peut donc exister par l'API. Le refus d'archiver une formation qui porte
        des sessions actives est inscrit aux critères de #35, avec les couches
        qui rendent ce comptage possible.

        L'ajouter ici supposerait de créer `SessionFormationRepository` en
        avance, hors du périmètre de cette issue, pour garder un cas
        actuellement inatteignable.
        """
        formation = self.obtenir(id_formation)
        self.formations.delete(formation)
        self.db.commit()
