"""Erreurs métier communes aux services.

Une erreur métier est une situation prévue par les règles de gestion (e-mail
déjà pris, identifiants faux), pas un incident technique. Les services lèvent
ces exceptions ; les routers les traduisent en codes HTTP. Aucune trace SQL ni
message d'ORM ne doit remonter jusqu'au client de l'API.
"""


class ErreurMetier(Exception):
    """Classe mère de toutes les erreurs métier."""


class ConflitMetier(ErreurMetier):
    """Ressource déjà existante ou état incompatible (HTTP 409)."""


class AuthentificationInvalide(ErreurMetier):
    """Identifiants refusés (HTTP 401)."""
