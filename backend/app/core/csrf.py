"""Middleware anti-CSRF : double-submit lié au JWT de session (dette T0.10).

Un cookie `httpOnly` (`delta_session`) authentifie automatiquement toute
requête que le navigateur émet, y compris celles qu'un site tiers déclenche à
l'insu de l'utilisateur — c'est le risque que l'en-tête `Authorization`
n'avait jamais, un site tiers ne pouvant pas le poser à la place du
navigateur.

Ce middleware exige, sur toute requête **mutante** qui porte ce cookie, un
en-tête `X-CSRF-Token` égal à la revendication `csrf` du jeton. Un site tiers
ne peut pas produire cette valeur : il ne peut ni lire le cookie
`delta_session` (`httpOnly`) ni, pour la même raison d'origine (« same-origin
policy »), lire le cookie `delta_csrf` posé sur l'origine de l'API — seul le
frontend légitime, exécuté sur cette origine, le peut.

Un seul point d'application, en middleware plutôt qu'une dépendance répétée
par endpoint mutant : même raisonnement que
`PersonnelService.obtenir_avec_fonction` (`docs/architecture.md`) — une règle
dupliquée par appelant diverge le jour où l'une des copies est corrigée sans
l'autre.
"""

from collections.abc import Awaitable, Callable

from fastapi import status
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.cookies import NOM_COOKIE_SESSION
from app.core.security import REVENDICATION_CSRF, decoder_jeton_acces

#: Méthodes qui changent un état côté serveur — seules concernées par le
#: double-submit. Une requête `GET` ne peut rien détourner à elle seule.
METHODES_MUTANTES = frozenset({"POST", "PUT", "PATCH", "DELETE"})

EN_TETE_CSRF = "X-CSRF-Token"

MESSAGE_CSRF_REFUSE = "Jeton anti-CSRF absent ou invalide."

# Chemins où une requête mutante ne protège encore aucune session en cours :
# le cookie qu'elle pourrait porter, s'il existe, vient d'une connexion
# précédente, sans rapport avec la tentative en cours — l'exiger là
# empêcherait un navigateur déjà connecté de se reconnecter sur un second
# compte. Miroir de `CHEMINS_PUBLICS` côté frontend (`axiosClient.ts`), pour
# la même raison mais côté CSRF plutôt que côté traitement du 401.
CHEMINS_EXEMPTES = (
    "/auth/connexion",
    "/auth/personnel/connexion",
    "/auth/inscription",
    "/auth/inscription-entreprise",
)


def _chemin_exempte(chemin: str) -> bool:
    return any(chemin.endswith(suffixe) for suffixe in CHEMINS_EXEMPTES)


async def middleware_csrf(
    request: Request, appel_suivant: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Vérifie le double-submit CSRF sur les requêtes mutantes authentifiées.

    Laisse passer sans vérification : les requêtes non mutantes ; celles sans
    cookie `delta_session` (rien à protéger — un `POST /commandes/invite`
    anonyme n'a pas de session à détourner, et un appel externe comme le
    webhook paiement n'en porte jamais) ; et les chemins de
    connexion/inscription.

    Un jeton de session illisible n'est **pas** traité ici comme un refus
    CSRF : c'est `get_current_client`/`get_current_personnel`, plus loin dans
    la chaîne, qui répondent 401 avec le message uniforme habituel — le
    dupliquer ici produirait un second message pour la même cause.
    """
    if request.method not in METHODES_MUTANTES:
        return await appel_suivant(request)

    jeton = request.cookies.get(NOM_COOKIE_SESSION)
    if jeton is None or _chemin_exempte(request.url.path):
        return await appel_suivant(request)

    charge_utile = decoder_jeton_acces(jeton)
    if charge_utile is None:
        return await appel_suivant(request)

    csrf_attendu = charge_utile.get(REVENDICATION_CSRF)
    csrf_recu = request.headers.get(EN_TETE_CSRF)
    if csrf_attendu is None or csrf_recu != csrf_attendu:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": MESSAGE_CSRF_REFUSE},
        )

    return await appel_suivant(request)
