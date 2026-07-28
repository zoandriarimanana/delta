"""Service métier de CLIENT : anonymisation et restauration de compte.

Ces deux opérations encadrent le cycle de vie d'un compte au-delà du simple
archivage. Elles vivent ici et non dans `auth_service`, qui ne traite que
l'entrée dans le système (inscription, connexion).
"""

import secrets

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, RessourceIntrouvable
from app.core.integrite import viole_contrainte
from app.core.security import hacher_mot_de_passe
from app.models.client import Client
from app.repositories.client_repository import ClientRepository

CONTRAINTE_EMAIL_UNIQUE = "uq_client_email"
CONTRAINTE_FISCAL_UNIQUE = "uq_client_entreprise_numero_id_fiscal"
INDICE_EMAIL = "client.email"
INDICE_FISCAL = "client_entreprise.numero_id_fiscal"

# Domaine réservé par la RFC 2606 : jamais routable, donc jamais joignable par
# erreur. L'adresse générée reste syntaxiquement valide, ce qui évite qu'une
# ligne anonymisée fasse échouer la validation d'un schéma de lecture.
DOMAINE_ANONYME = "delta.invalid"
MENTION_ANONYME = "Anonymisé"


class ClientService:
    """Cycle de vie d'un compte client, hors authentification."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.clients = ClientRepository(db)

    def _obtenir(self, id_client: int) -> Client:
        client = self.clients.get_by_id(id_client, inclure_supprimes=True)
        if client is None:
            raise RessourceIntrouvable("Client introuvable.")
        return client

    def anonymiser(self, id_client: int) -> Client:
        """Efface les données personnelles du client, sans supprimer la ligne.

        C'est **le seul chemin de conformité** pour un CLIENT (droit à
        l'effacement : RGPD, loi malgache n°2014-038).
        `supprimer_definitivement` ne convient pas : les FK en
        `ON DELETE RESTRICT` de `RESERVATION` et `AVIS` le refuseraient, et
        effacer une réservation honorée ou un avis reviendrait à détruire une
        preuve de transaction, généralement soumise à une obligation légale de
        conservation qui prime sur le droit à l'effacement.

        Sont réécrits : e-mail, mot de passe, téléphone, adresse, et l'identité
        portée par la table fille (nom/prénom, ou raison sociale et contact
        référent). Sont conservés : `id_client`, `type_client`, et **toutes** les
        lignes liées — réservations, avis, commandes, consommations gardent leur
        `id_client`, désormais anonyme.

        L'anonymisation **et** l'archivage sont posés ensemble : ce ne sont pas
        deux mécanismes concurrents. Le compte disparaît des lectures courantes
        et ne porte plus de donnée personnelle.

        Après l'appel, aucune connexion n'est possible : le mot de passe est
        remplacé par le haché d'un secret aléatoire que personne ne détient.
        """
        client = self._obtenir(id_client)

        client.email = f"supprime+{client.id_client}@{DOMAINE_ANONYME}"
        client.mot_de_passe = hacher_mot_de_passe(secrets.token_urlsafe(32))
        client.telephone = None
        client.adresse = None

        if client.particulier is not None:
            client.particulier.nom = MENTION_ANONYME
            client.particulier.prenom = MENTION_ANONYME
            client.particulier.date_naissance = None
        if client.entreprise is not None:
            client.entreprise.raison_sociale = MENTION_ANONYME
            client.entreprise.nom_contact_referent = None

        self._archiver_avec_sa_ligne_fille(client)
        self.db.commit()
        return client

    def _lignes_filles(self, client: Client) -> list[object]:
        """Retourne la ligne fille du client, s'il en a une.

        Le MLD en garantit exactement une — l'invariant n'étant tenu qu'au
        niveau applicatif (T0.7), on ne suppose rien et on collecte ce qui est
        présent.
        """
        return [f for f in (client.particulier, client.entreprise) if f is not None]

    def _archiver_avec_sa_ligne_fille(self, client: Client) -> None:
        """Archive le CLIENT **et** sa ligne fille, dans la même transaction.

        Un archivage est un `UPDATE` : le `ON DELETE CASCADE` des sous-types ne
        se déclenche pas. Propager est donc une responsabilité de service (voir
        la règle transverse de `docs/roadmap.md`).

        Ne pas le faire laissait la ligne fille active sous un parent archivé,
        avec une conséquence concrète : son `numero_id_fiscal` restait pris par
        l'index partiel, et une société anonymisée ne pouvait plus jamais se
        réinscrire avec le sien.
        """
        for fille in self._lignes_filles(client):
            self.clients.delete(fille)  # type: ignore[arg-type]
        self.clients.delete(client)

    def restaurer(self, id_client: int) -> Client:
        """Réactive un compte archivé.

        Sans effet si le compte est déjà actif : l'opération est idempotente,
        rejouer une restauration n'est pas une erreur métier.

        Peut en revanche échouer légitimement. `uq_client_email` étant un index
        *partiel*, l'e-mail du compte archivé a pu être réattribué entre-temps à
        un nouveau compte actif ; la restauration créerait alors deux comptes
        actifs de même adresse, et la base la refuse. Ce refus est traduit en
        message métier — jamais en trace SQL.

        Une anonymisation reste, elle, irréversible : restaurer un compte
        anonymisé rend la ligne visible, pas les données effacées.
        """
        client = self._obtenir(id_client)
        if client.supprime_le is None:
            return client

        try:
            self.clients.restaurer(client)
            for fille in self._lignes_filles(client):
                self.clients.restaurer(fille)  # type: ignore[arg-type]
            self.db.commit()
        except IntegrityError as erreur:
            self.db.rollback()
            if viole_contrainte(erreur, CONTRAINTE_EMAIL_UNIQUE, INDICE_EMAIL):
                raise ConflitMetier(
                    "Un compte actif utilise déjà cet e-mail, "
                    "restauration impossible."
                ) from erreur
            if viole_contrainte(erreur, CONTRAINTE_FISCAL_UNIQUE, INDICE_FISCAL):
                raise ConflitMetier(
                    "Une entreprise active utilise déjà ce numéro "
                    "d'identification fiscale, restauration impossible."
                ) from erreur
            raise
        return client
