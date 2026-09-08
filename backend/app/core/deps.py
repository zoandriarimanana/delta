"""Dépendances FastAPI transverses.

Ce module fait la jonction entre les primitives de `core/security.py` — qui ne
connaissent ni le framework ni la base — et les endpoints. C'est ici que vivent
les dépendances réutilisées par plusieurs routers, à commencer par
`get_current_client`.

Voir `docs/architecture.md`, section « Authentification des endpoints protégés ».

**Depuis T0.10, l'identité se lit dans le cookie `delta_session`, plus dans
l'en-tête `Authorization`.** Le jeton reste le même JWT qu'avant ; seul son
transport change — voir `core/cookies.py` pour l'émission et
`docs/roadmap.md` (Sprint 11) pour la micro-conception complète.
"""

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.cookies import NOM_COOKIE_SESSION
from app.core.database import get_db
from app.core.exceptions import AuthentificationInvalide, AutorisationInsuffisante
from app.core.security import REVENDICATION_TYPE, TypeSujet, decoder_jeton_acces
from app.models.client import Client
from app.models.personnel import Personnel
from app.repositories.client_repository import ClientRepository
from app.repositories.personnel_repository import PersonnelRepository

MESSAGE_REFUS = "Jeton d'accès absent ou invalide."
MESSAGE_DROITS = "Cette opération est réservée aux administrateurs."


def _identifiant_du_sujet(jeton: str | None, type_attendu: TypeSujet) -> int:
    """Valide le jeton et retourne l'identifiant qu'il désigne.

    Facteur commun aux deux dépendances : cookie présent, jeton lisible et non
    expiré, revendication `type` **égale à celle attendue**, `sub` entier.

    C'est cette égalité stricte qui cloisonne les deux populations. Un jeton de
    salarié présenté à `get_current_client` est refusé, et réciproquement — sans
    quoi le client n°5 et le salarié n°5 seraient interchangeables, leurs clés
    primaires se recouvrant.

    **Un jeton sans revendication `type` est refusé.** Il ne peut venir que d'une
    version antérieure à ce cloisonnement ; le lire par défaut comme un jeton
    client rouvrirait exactement la confusion qu'on ferme. Le coût est une
    reconnexion des sessions ouvertes, ce qu'une expiration aurait imposé de
    toute façon.

    Le message de refus reste le même dans tous les cas : distinguer « jeton
    expiré » de « mauvais type de compte » renseignerait un attaquant sans servir
    l'utilisateur légitime.
    """
    if jeton is None:
        raise AuthentificationInvalide(MESSAGE_REFUS)

    charge_utile = decoder_jeton_acces(jeton)
    if charge_utile is None:
        raise AuthentificationInvalide(MESSAGE_REFUS)

    if charge_utile.get(REVENDICATION_TYPE) != type_attendu.value:
        raise AuthentificationInvalide(MESSAGE_REFUS)

    sujet = charge_utile.get("sub")
    if sujet is None:
        raise AuthentificationInvalide(MESSAGE_REFUS)

    try:
        # `sub` est une chaîne par spécification JWT (cf. `creer_jeton_acces`),
        # alors que la clé primaire est un entier.
        return int(sujet)
    except (TypeError, ValueError) as erreur:
        raise AuthentificationInvalide(MESSAGE_REFUS) from erreur


def _charger_client(db: Session, identifiant: int) -> Client:
    """Charge le CLIENT désigné, ou refuse.

    Factorisé pour être partagé entre `get_current_client` (qui lève) et
    `get_sujet_optionnel` (qui ne lève jamais) — une seule règle de
    chargement, deux comportements d'échec.
    """
    client = ClientRepository(db).get_by_id(identifiant)
    if client is None:
        raise AuthentificationInvalide(MESSAGE_REFUS)
    return client


def _charger_personnel(db: Session, identifiant: int) -> Personnel:
    """Charge le PERSONNEL désigné, ou refuse.

    `mot_de_passe` étant nullable, un salarié peut n'avoir **aucun compte de
    connexion** : `NULL` signifie « ne se connecte pas », pas « mot de passe
    vide ». Le jeton d'un tel compte est refusé même s'il est
    cryptographiquement valide — le mot de passe a pu être retiré après son
    émission, exactement comme un compte peut être archivé après coup.
    """
    personnel = PersonnelRepository(db).get_by_id(identifiant)
    if personnel is None or personnel.mot_de_passe is None:
        raise AuthentificationInvalide(MESSAGE_REFUS)
    return personnel


def get_current_client(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> Client:
    """Retourne le CLIENT authentifié par le cookie `delta_session`.

    Lève `AuthentificationInvalide` — traduite en 401 par les gestionnaires
    globaux de `main.py` — dans cinq cas : cookie absent, jeton illisible ou
    signé avec une autre clé, jeton expiré, **jeton émis pour un salarié**, et
    compte disparu depuis l'émission du jeton. Ce dernier cas mérite d'être
    traité explicitement : un JWT reste cryptographiquement valide jusqu'à son
    expiration, y compris après la suppression du client qu'il désigne.

    Le message de refus est le même dans tous les cas : distinguer « jeton
    expiré » de « compte supprimé » renseignerait un attaquant sans servir
    l'utilisateur légitime, qui doit de toute façon se reconnecter.

    **Authentifie, n'autorise pas.** Aucun droit ne se dérive d'un compte
    client : tout client, particulier ou entreprise, est équivalent. Les
    opérations réservées passent par `get_current_personnel_administrateur`.
    """
    jeton = request.cookies.get(NOM_COOKIE_SESSION)
    identifiant = _identifiant_du_sujet(jeton, TypeSujet.CLIENT)
    return _charger_client(db, identifiant)


#: À utiliser dans les signatures d'endpoint : `client: ClientConnecte`.
ClientConnecte = Annotated[Client, Depends(get_current_client)]


def get_current_personnel(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> Personnel:
    """Retourne le membre du PERSONNEL authentifié par le cookie `delta_session`.

    Symétrique de `get_current_client`. **Authentifie, n'autorise pas.** Être
    salarié ne confère aucun droit d'administration — voir
    `get_current_personnel_administrateur`.
    """
    jeton = request.cookies.get(NOM_COOKIE_SESSION)
    identifiant = _identifiant_du_sujet(jeton, TypeSujet.PERSONNEL)
    return _charger_personnel(db, identifiant)


def get_current_personnel_administrateur(
    personnel: Annotated[Personnel, Depends(get_current_personnel)],
) -> Personnel:
    """Retourne le membre du personnel authentifié **et** administrateur.

    Seule des trois dépendances à autoriser plutôt qu'à authentifier, d'où le
    403 et non le 401 : l'appelant est identifié, il lui manque un droit, pas
    une preuve d'identité. Lui répondre 401 l'inviterait à se reconnecter pour
    un problème que la reconnexion ne réglera pas.

    Le droit vient de `est_administrateur` et **jamais de `fonction`** : l'un
    porte un droit, l'autre un métier (cf. `docs/mld.md`). Dériver les droits de
    la fonction interdirait qu'un formateur administre le catalogue.

    C'est cette dépendance qui lève la dette du Sprint 1 : les écritures du
    catalogue produit étaient jusqu'ici ouvertes à tout client inscrit.
    """
    if not personnel.est_administrateur:
        raise AutorisationInsuffisante(MESSAGE_DROITS)

    return personnel


#: À utiliser dans les signatures d'endpoint : `agent: PersonnelConnecte`.
PersonnelConnecte = Annotated[Personnel, Depends(get_current_personnel)]

#: Pour les endpoints d'administration : `admin: PersonnelAdministrateur`.
PersonnelAdministrateur = Annotated[
    Personnel, Depends(get_current_personnel_administrateur)
]


def get_sujet_optionnel(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> tuple[TypeSujet, Client | Personnel] | None:
    """Retourne `(type, sujet)` si le cookie de session désigne un compte valide,
    sinon `None` — jamais d'exception.

    Réservé à `GET /auth/moi` : contrairement à `get_current_client` et
    `get_current_personnel`, cet endpoint ne connaît pas d'avance la
    population attendue, il la découvre depuis la revendication `type` du
    jeton. Réutilise `_charger_client`/`_charger_personnel` — mêmes règles de
    chargement que les deux dépendances qui authentifient réellement un
    endpoint, pour qu'une correction faite à l'une ne diverge pas
    silencieusement de l'autre.
    """
    jeton = request.cookies.get(NOM_COOKIE_SESSION)
    if jeton is None:
        return None

    charge_utile = decoder_jeton_acces(jeton)
    if charge_utile is None:
        return None

    sujet = charge_utile.get("sub")
    if sujet is None:
        return None
    try:
        identifiant = int(sujet)
    except (TypeError, ValueError):
        return None

    type_valeur = charge_utile.get(REVENDICATION_TYPE)
    try:
        if type_valeur == TypeSujet.CLIENT.value:
            return (TypeSujet.CLIENT, _charger_client(db, identifiant))
        if type_valeur == TypeSujet.PERSONNEL.value:
            return (TypeSujet.PERSONNEL, _charger_personnel(db, identifiant))
    except AuthentificationInvalide:
        return None

    return None
