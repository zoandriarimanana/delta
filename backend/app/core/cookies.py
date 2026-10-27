"""Cookies de session : émission, effacement, noms partagés.

Remplace le jeton en `localStorage` (dette T0.10) par un cookie `httpOnly`,
invisible en JS et donc non exfiltrable par une faille XSS. Un second cookie,
non-`httpOnly`, porte le jeton anti-CSRF de `core/security.py` : lisible en
JS par construction (c'est le frontend qui doit pouvoir le relire pour le
recopier dans l'en-tête `X-CSRF-Token`), mais **jamais** la population de la
session — voir `JetonEmis` et la décision actée en micro-conception contre un
second cookie non-`httpOnly` portant `type` (`docs/roadmap.md`, Sprint 11).

Isolé de `security.py`, qui ne connaît ni le framework ni la notion de
réponse HTTP — même partage de responsabilités que `deps.py`/`security.py`.
"""

from fastapi import Response

from app.core.config import settings

#: Cookie `httpOnly` portant le JWT de session.
NOM_COOKIE_SESSION = "delta_session"

#: Cookie non-`httpOnly` portant le jeton anti-CSRF, en clair.
NOM_COOKIE_CSRF = "delta_csrf"


def _cookies_securises() -> bool:
    """`Secure` exige HTTPS — désactivé en développement (`http://localhost`).

    Même patron que la garde `Settings.ENVIRONMENT` de la simulation de
    paiement (Sprint 9.5) : défaut fermé, ouvert seulement en développement.
    """
    return settings.ENVIRONMENT == "production"


def poser_cookies_session(reponse: Response, jeton: str, csrf: str) -> None:
    """Pose les deux cookies de session sur la réponse de connexion.

    `max_age` aligné sur `ACCESS_TOKEN_EXPIRE_MINUTES` : le cookie ne doit pas
    survivre plus longtemps que le JWT qu'il porte, sous peine de laisser le
    navigateur representer un jeton déjà expiré à chaque requête.
    """
    duree_secondes = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    reponse.set_cookie(
        NOM_COOKIE_SESSION,
        jeton,
        max_age=duree_secondes,
        httponly=True,
        secure=_cookies_securises(),
        samesite="lax",
        path="/",
    )
    reponse.set_cookie(
        NOM_COOKIE_CSRF,
        csrf,
        max_age=duree_secondes,
        httponly=False,
        secure=_cookies_securises(),
        samesite="lax",
        path="/",
    )


def effacer_cookies_session(reponse: Response) -> None:
    """Efface les deux cookies — chemin unique de déconnexion.

    Nécessaire côté serveur : `delta_session` étant `httpOnly`, aucun script
    ne peut l'effacer depuis le navigateur.
    """
    reponse.delete_cookie(
        NOM_COOKIE_SESSION,
        path="/",
        secure=_cookies_securises(),
        samesite="lax",
    )
    reponse.delete_cookie(
        NOM_COOKIE_CSRF,
        path="/",
        secure=_cookies_securises(),
        samesite="lax",
    )
