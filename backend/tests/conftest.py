"""Outils partagés par les tests.

Deux pièges de SQLite sont traités ici plutôt que dans chaque fichier :

1. **Les clés étrangères ne sont pas appliquées par défaut.** Sans le `PRAGMA`
   ci-dessous, un `ON DELETE RESTRICT` ne déclencherait rien et un test de
   suppression bloquée passerait au vert sans rien prouver.
2. **SQLite ne nomme pas la contrainte violée** — son message est
   « UNIQUE constraint failed: table.colonne », là où PostgreSQL fournit
   `diag.constraint_name`. Les branches de traduction qui s'appuient sur ce nom
   sont donc exercées avec une erreur fabriquée, `erreur_integrite_postgres`,
   qui imite la forme psycopg2.

Ce module fournit en outre `session_postgres`, pour les tests qui **ne peuvent
pas** tourner sur SQLite — voir sa docstring.

**Troisième piège, sans rapport avec SQLite** : `app.core.rate_limit.limiter`
est un singleton unique pour tout le process pytest, comme pour l'application
réelle. Sans réinitialisation entre les tests, les appels à `/auth/connexion`
et `/auth/personnel/connexion` d'un test s'additionneraient à ceux du
précédent — un test sans aucun rapport avec le rate limiting pourrait recevoir
429 au lieu du code attendu, simplement parce qu'un test antérieur a déjà
consommé une partie de la limite pour la même adresse IP (celle que
`TestClient` utilise par défaut, partagée par tous les tests). L'autofixture
ci-dessous repart de zéro avant chaque test, qu'il touche ou non ces
endpoints.

**Quatrième outil, `authentifier()`** : depuis T0.10, l'identité ne se lit
plus dans un en-tête `Authorization` mais dans le cookie `delta_session`, et
toute requête mutante qui le porte exige en plus un en-tête `X-CSRF-Token`
(`core/csrf.py`). Un test qui fabrique lui-même un jeton (sans passer par
`POST /auth/connexion`) doit donc produire ces en-têtes — cette fonction
centralise le geste, pour que les dizaines de fichiers de tests qui
authentifient ainsi ne divergent pas dans la façon de le faire.

Elle pose `Cookie` comme un **en-tête de requête ordinaire**, jamais sur
`client_http.cookies` (le "cookie jar" partagé par toutes les requêtes du
`TestClient`, comme un vrai navigateur le ferait). Une première version
posait la session sur ce jar partagé — elle s'est révélée fausse dès qu'un
test authentifie deux identités différentes dans le même corps (comparer
« l'entreprise A » et « l'entreprise B », par exemple) : la seconde
authentification écrasait la première sur le jar, et une requête ultérieure
censée rejouer la première s'exécutait silencieusement sous la seconde
identité. Un en-tête `Cookie` par requête rend chaque appel indépendant des
autres — exactement le modèle de l'ancien en-tête `Authorization`, un jeton
par requête plutôt qu'une session partagée entre elles.
"""

from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.cookies import NOM_COOKIE_CSRF, NOM_COOKIE_SESSION
from app.core.database import Base
from app.core.database import engine as engine_application
from app.core.rate_limit import limiter
from app.core.security import TypeSujet, creer_jeton_acces


@pytest.fixture(autouse=True)
def _reinitialiser_le_limiteur() -> None:
    limiter.reset()


def authentifier(identifiant: int, type_sujet: TypeSujet) -> dict[str, str]:
    """Retourne les en-têtes qui authentifient une requête pour ce sujet.

    `Cookie` porte les deux cookies de session à la main (jamais posés sur le
    `TestClient`, voir ci-dessus) ; `X-CSRF-Token` satisfait le middleware
    anti-CSRF sur les méthodes mutantes. L'inclure aussi sur un `GET` est
    sans effet : le middleware ne regarde que les méthodes mutantes.
    """
    jeton = creer_jeton_acces(identifiant, type_sujet)
    cookie = f"{NOM_COOKIE_SESSION}={jeton.jeton}; {NOM_COOKIE_CSRF}={jeton.csrf}"
    return {"Cookie": cookie, "X-CSRF-Token": jeton.csrf}


def creer_engine_sqlite(*tables: object) -> Engine:
    """Engine SQLite en mémoire, clés étrangères actives, tables demandées créées.

    `StaticPool` et `check_same_thread=False` partagent l'unique connexion :
    SQLite crée une base distincte par connexion, et TestClient exécute les
    endpoints synchrones dans un autre thread.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _activer_cles_etrangeres(connexion_dbapi: object, _: object) -> None:
        curseur = connexion_dbapi.cursor()  # type: ignore[attr-defined]
        curseur.execute("PRAGMA foreign_keys=ON")
        curseur.close()

    Base.metadata.create_all(engine, tables=list(tables))  # type: ignore[arg-type]
    return engine


@pytest.fixture
def session_postgres() -> Iterator[Session]:
    """Session sur le PostgreSQL réel, entièrement annulée en fin de test.

    Réservée aux tests que SQLite ne peut pas porter fidèlement. Le cas qui l'a
    motivée : le `CHECK` de `RESERVATION` utilise la syntaxe PostgreSQL
    `(colonne IS NOT NULL)::int`, que SQLite ne sait pas créer. Écrire ce test
    sur SQLite supposerait d'affaiblir la table jusqu'à ne plus vérifier le
    comportement de production — ce qui lui ôterait tout intérêt.

    Le test s'exécute dans une transaction externe annulée à la sortie : rien
    n'est laissé en base, même si le service appelé fait ses propres `commit`
    (d'où `join_transaction_mode="create_savepoint"`).

    Ignoré avec un message explicite si la base est injoignable, pour qu'un
    poste sans `docker compose up` ne bloque pas la suite. La CI, elle, fournit
    le service : le test y tourne réellement.

    Suppose le schéma migré (`alembic upgrade head`), ce que fait la CI avant
    d'appeler pytest.
    """
    try:
        connexion = engine_application.connect()
    except OperationalError as erreur:
        pytest.skip(f"PostgreSQL injoignable ({erreur.orig}) — test ignoré.")

    transaction = connexion.begin()
    session = Session(bind=connexion, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connexion.close()


class _Diagnostic:
    """Imite `psycopg2.extensions.Diagnostics`, réduit au champ utilisé."""

    def __init__(self, nom_contrainte: str) -> None:
        self.constraint_name = nom_contrainte


class _ErreurOrigine(Exception):
    """Imite l'exception psycopg2 sous-jacente à une `IntegrityError`."""

    def __init__(self, nom_contrainte: str) -> None:
        self.diag = _Diagnostic(nom_contrainte)
        super().__init__(f"violation simulee de {nom_contrainte}")


def erreur_integrite_postgres(nom_contrainte: str) -> IntegrityError:
    """Fabrique une `IntegrityError` telle que PostgreSQL la remonterait.

    Permet d'exercer les branches de traduction qui identifient la contrainte
    par son nom — impossible à obtenir depuis SQLite, qui ne le fournit pas.
    """
    return IntegrityError("requete simulee", {}, _ErreurOrigine(nom_contrainte))
