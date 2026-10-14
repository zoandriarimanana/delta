"""Envoi d'e-mails par SMTP (14 octobre 2026).

Module transverse, comme `security.py` : il ne connaît aucune entité. Un
envoi qui échoue **ne lève pas** — il renvoie `False` et l'écrit au
journal : l'action qui l'a déclenché (une inscription) ne doit pas être
défaite pour un serveur de messagerie indisponible.
"""

import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.core.logging import get_logger

journal = get_logger(__name__)


def smtp_configure() -> bool:
    """Vrai si un serveur SMTP est renseigné."""
    return bool(settings.SMTP_HOST)


def envoyer_courriel(destinataire: str, sujet: str, texte: str) -> bool:
    """Envoie un e-mail en texte simple ; `False` si l'envoi a échoué ou si
    aucun serveur n'est configuré."""
    if not smtp_configure():
        journal.warning("Aucun serveur SMTP configuré : e-mail non envoyé.")
        return False
    message = EmailMessage()
    message["From"] = settings.SMTP_EXPEDITEUR or settings.SMTP_UTILISATEUR
    message["To"] = destinataire
    message["Subject"] = sujet
    message.set_content(texte)
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if settings.SMTP_UTILISATEUR:
                smtp.login(settings.SMTP_UTILISATEUR, settings.SMTP_MOT_DE_PASSE)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        journal.exception("Échec de l'envoi d'un e-mail")
        return False
    return True
