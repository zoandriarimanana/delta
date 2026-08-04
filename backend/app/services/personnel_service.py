"""Service métier de PERSONNEL."""

from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, RessourceIntrouvable
from app.core.integrite import viole_contrainte
from app.models.personnel import FonctionPersonnel, Personnel
from app.repositories.personnel_repository import PersonnelRepository
from app.schemas.personnel import PersonnelCreate, PersonnelUpdate

CONTRAINTE_EMAIL_UNIQUE = "uq_personnel_email"
INDICE_EMAIL = "personnel.email"

MESSAGE_EMAIL_PRIS = "Un membre du personnel actif utilise déjà cette adresse."


class PersonnelService:
    """Règles de gestion du personnel, toutes fonctions confondues.

    Aucune fonction n'est traitée à part : un `Cuisinier` se crée, se modifie et
    s'archive exactement comme un `Formateur`. Les règles qui dépendent de la
    fonction — refuser un cuisinier sur une livraison, un livreur sur une
    session de formation — appartiennent aux services qui font l'affectation
    (#25, sprint 4), pas à celui-ci.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.personnels = PersonnelRepository(db)

    def lister(self, fonction: FonctionPersonnel | None = None) -> Sequence[Personnel]:
        """Retourne le personnel, filtré par fonction si demandé.

        Une fonction sans titulaire donne une liste vide, pas une erreur : c'est
        un critère de recherche, pas une ressource désignée par l'URL.
        """
        if fonction is None:
            return self.personnels.list()
        return self.personnels.lister_par_fonction(fonction)

    def obtenir(self, id_personnel: int) -> Personnel:
        """Retourne un membre du personnel, ou lève `RessourceIntrouvable` (404)."""
        personnel = self.personnels.get_by_id(id_personnel)
        if personnel is None:
            raise RessourceIntrouvable("Membre du personnel introuvable.")
        return personnel

    def _refuser_email_pris(self, email: str) -> None:
        """Pré-contrôle d'unicité de l'adresse professionnelle.

        Il donne un message clair dans le cas courant, mais ne suffit pas : deux
        créations simultanées le passent toutes les deux. C'est l'interception
        de l'`IntegrityError` qui tranche réellement.
        """
        if self.personnels.get_by_email(email) is not None:
            raise ConflitMetier(MESSAGE_EMAIL_PRIS)

    def creer(self, donnees: PersonnelCreate) -> Personnel:
        """Crée un membre du personnel.

        Double protection sur l'e-mail : le pré-contrôle pour le message, et
        l'interception de la violation d'index pour la course entre deux
        créations concurrentes. L'index étant *partiel*, seule une ligne
        **active** entre en conflit — un homonyme archivé ne bloque pas.
        """
        self._refuser_email_pris(donnees.email)
        try:
            personnel = self.personnels.create(donnees.model_dump())
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_EMAIL_UNIQUE, INDICE_EMAIL):
                raise ConflitMetier(MESSAGE_EMAIL_PRIS) from erreur
            raise
        return personnel

    def modifier(self, id_personnel: int, donnees: PersonnelUpdate) -> Personnel:
        """Met à jour un membre du personnel, en revalidant l'e-mail s'il change."""
        personnel = self.obtenir(id_personnel)
        modifications = donnees.model_dump(exclude_unset=True)

        # Réattribuer à quelqu'un sa propre adresse n'est pas un conflit.
        nouvel_email = modifications.get("email")
        if nouvel_email is not None and nouvel_email != personnel.email:
            self._refuser_email_pris(nouvel_email)

        try:
            self.personnels.update(personnel, modifications)
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_EMAIL_UNIQUE, INDICE_EMAIL):
                raise ConflitMetier(MESSAGE_EMAIL_PRIS) from erreur
            raise
        return personnel

    def supprimer(self, id_personnel: int) -> None:
        """Archive un membre du personnel.

        Archivage et non suppression réelle : `supprimer_definitivement()` est
        **inapplicable** à `PERSONNEL`. Les FK de `LIVRAISON` et
        `SESSION_FORMATION` le refuseraient, et effacer un livreur reviendrait à
        détruire la trace de qui a effectué une livraison — une preuve de
        transaction.

        Conséquence à connaître, et qui sera levée par #23 : les données
        personnelles du salarié restent lisibles en base après archivage.
        `PersonnelService.anonymiser()` n'existe pas encore (dette inscrite dans
        `docs/roadmap.md` depuis le Sprint 1).

        L'archivage ne se propage à rien : ni `LIVRAISON` ni `SESSION_FORMATION`
        ne disparaissent avec leur titulaire. C'est voulu — une livraison passée
        reste un fait, même après le départ du livreur.
        """
        personnel = self.obtenir(id_personnel)
        self.personnels.delete(personnel)
        self.db.commit()

    def restaurer(self, id_personnel: int) -> Personnel:
        """Réactive un membre du personnel archivé — le retour d'un salarié.

        Sans effet s'il est déjà actif : l'opération est idempotente.

        Peut échouer légitimement. `uq_personnel_email` étant *partiel*,
        l'adresse libérée par l'archivage a pu être réattribuée entre-temps ; la
        restauration créerait alors deux lignes actives de même adresse, et la
        base la refuse. Ce refus est traduit en message métier, jamais en trace
        SQL.
        """
        personnel = self.personnels.get_by_id(id_personnel, inclure_supprimes=True)
        if personnel is None:
            raise RessourceIntrouvable("Membre du personnel introuvable.")
        if personnel.supprime_le is None:
            return personnel

        try:
            self.personnels.restaurer(personnel)
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_EMAIL_UNIQUE, INDICE_EMAIL):
                raise ConflitMetier(
                    "Un membre du personnel actif utilise déjà cette adresse, "
                    "restauration impossible."
                ) from erreur
            raise
        return personnel
