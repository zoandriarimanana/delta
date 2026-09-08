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


class AutorisationInsuffisante(ErreurMetier):
    """Compte authentifié, mais dépourvu du droit requis (HTTP 403).

    À ne pas confondre avec `AuthentificationInvalide` : là, on ne sait pas qui
    appelle ; ici, on le sait et on refuse quand même. Les deux codes ne se
    substituent pas — répondre 401 à un salarié non administrateur l'inviterait
    à se reconnecter pour un problème que sa reconnexion ne réglera pas.

    Le message peut être explicite sans rien divulguer : l'appelant connaît déjà
    sa propre identité et ses propres droits.
    """


class RessourceIntrouvable(ErreurMetier):
    """La ressource désignée par l'URL n'existe pas (HTTP 404)."""


class ReferenceInvalide(ErreurMetier):
    """Une clé étrangère du corps de la requête ne désigne rien (HTTP 422).

    Distinct de `RessourceIntrouvable` : ici l'URL est valide, c'est le contenu
    envoyé qui ne l'est pas — au même titre qu'un prix négatif. Voir
    `docs/architecture.md`, section « Codes d'erreur : 404 contre 422 ».
    """
