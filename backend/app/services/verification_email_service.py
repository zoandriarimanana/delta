"""Vérification de l'adresse e-mail d'un CLIENT (14 octobre 2026).

Un compte inscrit par l'API naît **non vérifié** ; un code à 6 chiffres part
par e-mail, et seule sa saisie ouvre la connexion. But : qu'un compte
corresponde à une vraie adresse, que son titulaire lit.

Le code n'est **jamais stocké en clair** : une empreinte HMAC (clé
`SECRET_KEY`) suffit à le comparer. Il expire après
`CODE_VERIFICATION_MINUTES` et ne tolère que `ESSAIS_MAX` erreurs.

Les réponses ne disent jamais si une adresse a un compte : un code faux et
une adresse inconnue reçoivent le même refus, et le renvoi répond pareil
dans tous les cas.
"""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.courriel import envoyer_courriel, smtp_configure
from app.core.exceptions import ReferenceInvalide
from app.core.logging import get_logger
from app.models.client import Client
from app.repositories.client_repository import ClientRepository

journal = get_logger(__name__)

ESSAIS_MAX = 5
MESSAGE_CODE_INVALIDE = (
    "Code incorrect ou expiré. Vérifiez le dernier e-mail reçu, ou demandez un "
    "nouveau code."
)


def _empreinte(id_client: int, code: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), f"{id_client}:{code}".encode(), hashlib.sha256
    ).hexdigest()


class VerificationEmailService:
    """Envoi et contrôle du code de vérification d'un client."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.clients = ClientRepository(db)

    def exiger_verification(self, client: Client) -> None:
        """Marque un compte tout juste inscrit comme non vérifié et lui envoie
        un code. Appelé **après** le `commit` de l'inscription : un e-mail qui
        ne part pas ne défait pas le compte, « Renvoyer le code » rattrape."""
        client.email_verifie_le = None
        self._envoyer(client)

    def renvoyer(self, email: str) -> None:
        """Nouveau code pour un compte non vérifié. Ne dit rien d'une adresse
        inconnue ou déjà vérifiée : la réponse est la même."""
        client = self.clients.get_by_email(email)
        if client is not None and client.email_verifie_le is None:
            self._envoyer(client)

    def verifier(self, email: str, code: str) -> Client:
        """Confirme l'adresse si le code est le bon ; 422 sinon, avec le même
        message pour une adresse inconnue. Au-delà de `ESSAIS_MAX` erreurs, le
        code est invalidé : il faut en redemander un."""
        client = self.clients.get_by_email(email)
        if client is None or client.email_verifie_le is not None:
            if client is not None:
                return client  # Déjà vérifié : rien à refaire.
            raise ReferenceInvalide(MESSAGE_CODE_INVALIDE)
        maintenant = datetime.now(UTC)
        expire_le = client.code_expire_le
        if expire_le is not None and expire_le.tzinfo is None:
            # SQLite (tests) rend les dates sans fuseau ; elles sont en UTC.
            expire_le = expire_le.replace(tzinfo=UTC)
        valide = (
            client.code_verification is not None
            and expire_le is not None
            and expire_le > maintenant
            and client.essais_code < ESSAIS_MAX
        )
        if valide and hmac.compare_digest(
            client.code_verification or "", _empreinte(client.id_client, code)
        ):
            client.email_verifie_le = maintenant
            client.code_verification = None
            client.code_expire_le = None
            client.essais_code = 0
            self.db.commit()
            return client
        if client.code_verification is not None:
            client.essais_code += 1
            self.db.commit()
        raise ReferenceInvalide(MESSAGE_CODE_INVALIDE)

    def _envoyer(self, client: Client) -> None:
        code = f"{secrets.randbelow(1_000_000):06d}"
        client.code_verification = _empreinte(client.id_client, code)
        client.code_expire_le = datetime.now(UTC) + timedelta(
            minutes=settings.CODE_VERIFICATION_MINUTES
        )
        client.essais_code = 0
        self.db.commit()
        envoye = envoyer_courriel(
            client.email,
            "Delta — votre code de vérification",
            "Bonjour,\n\n"
            f"Votre code de vérification Delta est : {code}\n\n"
            f"Il est valable {settings.CODE_VERIFICATION_MINUTES} minutes. "
            "Saisissez-le sur le site pour activer votre compte.\n\n"
            "Si vous n'avez pas créé de compte, ignorez cet e-mail.\n\n"
            "L'équipe Delta",
        )
        if (
            not envoye
            and not smtp_configure()
            and settings.ENVIRONMENT == "developpement"
        ):
            # Développement sans serveur de messagerie : le code reste
            # accessible pour tester. Jamais en production.
            journal.warning("Code de vérification de %s : %s", client.email, code)
