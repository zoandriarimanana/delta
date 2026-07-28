"""Service d'authentification : inscription et connexion des deux sous-types.

La connexion est **commune** : elle porte sur `CLIENT.email` et
`CLIENT.mot_de_passe`, partagés par le particulier et l'entreprise. Seule
l'inscription diffère, par la table fille qu'elle renseigne.
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AuthentificationInvalide, ConflitMetier
from app.core.integrite import viole_contrainte
from app.core.security import hacher_mot_de_passe, verifier_mot_de_passe
from app.models.client import Client, TypeClient
from app.repositories.client_entreprise_repository import ClientEntrepriseRepository
from app.repositories.client_particulier_repository import ClientParticulierRepository
from app.repositories.client_repository import ClientRepository
from app.schemas.auth import Connexion, InscriptionEntreprise, InscriptionParticulier

CONTRAINTE_EMAIL_UNIQUE = "uq_client_email"
CONTRAINTE_FISCAL_UNIQUE = "uq_client_entreprise_numero_id_fiscal"

# Fragments par lesquels SQLite designe ces contraintes, faute de les nommer.
INDICE_EMAIL = "client.email"
INDICE_FISCAL = "client_entreprise.numero_id_fiscal"

MESSAGE_EMAIL_PRIS = "Cet e-mail est déjà utilisé."
MESSAGE_FISCAL_PRIS = "Ce numéro d'identification fiscale est déjà utilisé."

# Hash bcrypt d'une valeur arbitraire, comparé quand l'e-mail est inconnu afin
# que la connexion coûte le même temps qu'il existe ou non — sans quoi la durée
# de réponse permet d'énumérer les comptes.
_HASH_LEURRE = hacher_mot_de_passe("mot_de_passe_leurre_pour_temps_constant")


class EmailDejaUtilise(ConflitMetier):
    """Un compte actif existe déjà pour cet e-mail."""


class NumeroFiscalDejaUtilise(ConflitMetier):
    """Une entreprise active porte déjà ce numéro d'identification fiscale."""


def _est_conflit_email(erreur: IntegrityError) -> bool:
    """Distingue une violation de `uq_client_email` d'une autre violation."""
    return viole_contrainte(erreur, CONTRAINTE_EMAIL_UNIQUE, INDICE_EMAIL)


def _est_conflit_fiscal(erreur: IntegrityError) -> bool:
    """Distingue une violation de `uq_client_entreprise_numero_id_fiscal`.

    Discriminer par le nom de la contrainte n'est pas une précaution de style :
    une inscription entreprise peut buter sur l'une **ou** l'autre des deux
    unicités, et les confondre afficherait « e-mail déjà utilisé » à qui a saisi
    un numéro fiscal en double.
    """
    return viole_contrainte(erreur, CONTRAINTE_FISCAL_UNIQUE, INDICE_FISCAL)


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
        self.entreprises = ClientEntrepriseRepository(db)

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
            raise EmailDejaUtilise(MESSAGE_EMAIL_PRIS)

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
                raise EmailDejaUtilise(MESSAGE_EMAIL_PRIS) from erreur
            raise

        return client

    def inscrire_entreprise(self, donnees: InscriptionEntreprise) -> Client:
        """Crée un compte entreprise et retourne le CLIENT créé.

        Même structure que `inscrire_particulier`, avec **deux** unicités à
        protéger au lieu d'une : l'e-mail, porté par CLIENT, et le numéro
        d'identification fiscale, porté par la ligne fille.

        Chacune suit le double schéma désormais habituel — pré-contrôle pour le
        message clair, interception de l'`IntegrityError` pour la course entre
        deux inscriptions simultanées. Les deux conflits sont distingués **par
        le nom de la contrainte** : les confondre afficherait « e-mail déjà
        utilisé » à qui a saisi un numéro fiscal en double.

        Sur le message d'e-mail : il reste identique à celui du particulier, et
        volontairement neutre. Répondre « vous avez déjà un compte particulier »
        divulguerait l'existence d'un compte à qui saisit une adresse au hasard.

        Les deux écritures partagent une seule transaction — c'est la garde
        applicative qui tient l'invariant d'exclusivité en l'absence du trigger
        reporté (T0.7).
        """
        if self.clients.get_by_email(donnees.email) is not None:
            raise EmailDejaUtilise(MESSAGE_EMAIL_PRIS)
        if (
            self.entreprises.get_by_numero_id_fiscal(donnees.identite.numero_id_fiscal)
            is not None
        ):
            raise NumeroFiscalDejaUtilise(MESSAGE_FISCAL_PRIS)

        try:
            client = self.clients.create(
                {
                    "type_client": TypeClient.ENTREPRISE,
                    "email": donnees.email,
                    "telephone": donnees.telephone,
                    "adresse": donnees.adresse,
                    "mot_de_passe": hacher_mot_de_passe(donnees.mot_de_passe),
                }
            )
            entreprise = self.entreprises.create(
                {
                    "id_client": client.id_client,
                    **donnees.identite.model_dump(),
                }
            )
            client.entreprise = entreprise
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if _est_conflit_email(erreur):
                raise EmailDejaUtilise(MESSAGE_EMAIL_PRIS) from erreur
            if _est_conflit_fiscal(erreur):
                raise NumeroFiscalDejaUtilise(MESSAGE_FISCAL_PRIS) from erreur
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
