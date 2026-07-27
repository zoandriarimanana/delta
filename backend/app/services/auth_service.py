"""Service d'authentification : inscription et connexion d'un CLIENT_PARTICULIER."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AuthentificationInvalide, ConflitMetier
from app.core.security import hacher_mot_de_passe, verifier_mot_de_passe
from app.models.client import Client, TypeClient
from app.repositories.client_particulier_repository import ClientParticulierRepository
from app.repositories.client_repository import ClientRepository
from app.schemas.auth import Connexion, InscriptionParticulier

CONTRAINTE_EMAIL_UNIQUE = "uq_client_email"

# Hash bcrypt d'une valeur arbitraire, comparé quand l'e-mail est inconnu afin
# que la connexion coûte le même temps qu'il existe ou non — sans quoi la durée
# de réponse permet d'énumérer les comptes.
_HASH_LEURRE = hacher_mot_de_passe("mot_de_passe_leurre_pour_temps_constant")


class EmailDejaUtilise(ConflitMetier):
    """Un compte existe déjà pour cet e-mail."""


def _est_conflit_email(erreur: IntegrityError) -> bool:
    """Distingue une violation de `uq_client_email` d'une autre violation.

    PostgreSQL expose le nom de la contrainte violée via `diag` (psycopg2), ce
    qui est le test fiable. On retombe sur le message brut pour les backends qui
    ne fournissent pas ce diagnostic — SQLite, utilisé par les tests, dit
    « UNIQUE constraint failed: client.email ».
    """
    nom_contrainte = getattr(
        getattr(erreur.orig, "diag", None), "constraint_name", None
    )
    if nom_contrainte:
        return nom_contrainte == CONTRAINTE_EMAIL_UNIQUE
    message = str(erreur.orig).lower()
    return CONTRAINTE_EMAIL_UNIQUE in message or "client.email" in message


class AuthService:
    """Orchestre les deux repositories du parcours d'inscription.

    L'inscription écrit dans `CLIENT` **et** `CLIENT_PARTICULIER` : les deux
    écritures partagent une seule transaction, seule garantie actuelle qu'un
    CLIENT ne reste pas orphelin de sa ligne fille. Le trigger d'exclusivité
    prévu par `docs/mld.md` est reporté (dette technique T0.7).
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.clients = ClientRepository(db)
        self.particuliers = ClientParticulierRepository(db)

    def inscrire_particulier(self, donnees: InscriptionParticulier) -> Client:
        """Crée un compte particulier et retourne le CLIENT créé.

        Deux niveaux de protection contre le doublon d'e-mail, volontairement
        redondants :

        1. un pré-contrôle, qui produit un message clair dans le cas courant ;
        2. l'interception de l'`IntegrityError` sur `uq_client_email`, qui
           couvre la course entre deux inscriptions simultanées — entre le
           pré-contrôle et le `commit`, une autre transaction peut avoir inséré
           le même e-mail. Seule la contrainte en base tranche réellement.

        Lève `EmailDejaUtilise` dans les deux cas.
        """
        if self.clients.get_by_email(donnees.email) is not None:
            raise EmailDejaUtilise("Cet e-mail est déjà utilisé.")

        try:
            client = self.clients.create(
                {
                    "type_client": TypeClient.PARTICULIER,
                    "email": donnees.email,
                    "telephone": donnees.telephone,
                    "adresse": donnees.adresse,
                    "mot_de_passe": hacher_mot_de_passe(donnees.mot_de_passe),
                }
            )
            particulier = self.particuliers.create(
                {
                    "id_client": client.id_client,
                    **donnees.identite.model_dump(),
                }
            )
            # Rend le graphe en mémoire cohérent : sans cette affectation, la
            # sérialisation de la réponse déclencherait un rechargement SQL de
            # la ligne fille qu'on vient pourtant d'écrire.
            client.particulier = particulier
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if _est_conflit_email(erreur):
                raise EmailDejaUtilise("Cet e-mail est déjà utilisé.") from erreur
            raise

        return client

    def authentifier(self, identifiants: Connexion) -> Client:
        """Vérifie les identifiants et retourne le CLIENT correspondant.

        Lève `AuthentificationInvalide` avec le même message que l'e-mail soit
        inconnu ou le mot de passe faux : distinguer les deux cas révélerait
        quelles adresses ont un compte.
        """
        client = self.clients.get_by_email(identifiants.email)
        hash_a_verifier = client.mot_de_passe if client is not None else _HASH_LEURRE

        if not verifier_mot_de_passe(identifiants.mot_de_passe, hash_a_verifier):
            raise AuthentificationInvalide("E-mail ou mot de passe incorrect.")
        if client is None:
            raise AuthentificationInvalide("E-mail ou mot de passe incorrect.")

        return client
