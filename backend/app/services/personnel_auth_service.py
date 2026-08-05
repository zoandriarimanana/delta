"""Service d'authentification de PERSONNEL.

Fichier distinct de `auth_service.py`, qui traite `CLIENT` : un fichier ne mêle
pas deux entités (cf. `docs/architecture.md`). Les deux services se ressemblent
sans se confondre — `PERSONNEL` n'a pas d'inscription, et son mot de passe est
nullable.
"""

from sqlalchemy.orm import Session

from app.core.exceptions import AuthentificationInvalide
from app.core.security import hacher_mot_de_passe, verifier_mot_de_passe
from app.models.personnel import Personnel
from app.repositories.personnel_repository import PersonnelRepository
from app.schemas.auth import Connexion

MESSAGE_REFUS = "E-mail ou mot de passe incorrect."

# Hash comparé quand l'adresse est inconnue **ou sans mot de passe**, afin que la
# connexion coûte le même temps dans tous les cas. Sans lui, la durée de réponse
# distinguerait un salarié inexistant d'un salarié sans compte de connexion, et
# permettrait d'énumérer l'annuaire.
_HASH_LEURRE = hacher_mot_de_passe("mot_de_passe_leurre_pour_temps_constant")


class PersonnelAuthService:
    """Vérifie les identifiants d'un membre du personnel.

    Il n'y a **pas d'inscription** ici, et c'est structurel : un salarié est créé
    par l'annuaire (`PersonnelService`) ou par le script d'amorçage, jamais en
    s'inscrivant lui-même. Un endpoint d'inscription au personnel reviendrait à
    laisser n'importe qui entrer dans l'organigramme.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.personnels = PersonnelRepository(db)

    def authentifier(self, identifiants: Connexion) -> Personnel:
        """Retourne le membre du personnel correspondant, ou lève 401.

        Trois refus, un seul message : adresse inconnue, mot de passe faux, et
        compte sans mot de passe. Ce dernier n'est pas une erreur de données —
        `NULL` signifie « ne se connecte pas », un cuisinier peut n'avoir aucun
        besoin d'un compte. Le distinguer des deux autres révélerait quelles
        adresses existent dans l'annuaire.

        Un salarié archivé est déjà écarté par `get_by_email`, qui filtre les
        lignes archivées.
        """
        personnel = self.personnels.get_by_email(identifiants.email)

        empreinte = _HASH_LEURRE
        if personnel is not None and personnel.mot_de_passe is not None:
            empreinte = personnel.mot_de_passe

        # La vérification est faite dans tous les cas, y compris quand on sait
        # déjà qu'elle échouera : c'est ce qui garde le temps de réponse
        # constant.
        correspond = verifier_mot_de_passe(identifiants.mot_de_passe, empreinte)

        if not correspond or personnel is None or personnel.mot_de_passe is None:
            raise AuthentificationInvalide(MESSAGE_REFUS)

        return personnel
