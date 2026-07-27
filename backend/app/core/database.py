"""Socle SQLAlchemy : moteur de connexion, fabrique de sessions et classe de base.

Ce module ne contient aucune logique métier ni aucun mapping d'entité. Il expose
uniquement les briques dont dépendent les couches supérieures :

- ``engine``       : le moteur de connexion PostgreSQL ;
- ``SessionLocal`` : la fabrique de sessions ;
- ``Base``         : la classe mère de tous les modèles de ``app/models/`` ;
- ``get_db``       : la dépendance FastAPI qui injecte une session par requête.
"""

from collections.abc import Generator

from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

# Convention de nommage des contraintes et index.
# Sans elle, PostgreSQL génère des noms implicites qu'Alembic ne sait pas cibler
# de façon fiable : une migration de suppression de contrainte devient alors
# impossible à écrire sans aller lire le nom réel en base. On la pose ici, une
# fois pour toutes, avant la première migration (T0.5).
NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

engine = create_engine(
    settings.DATABASE_URL,
    # Vérifie la vivacité de la connexion avant de la sortir du pool : évite les
    # erreurs sur connexion coupée côté serveur après une période d'inactivité.
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    # Compromis assumé : par défaut SQLAlchemy expire tous les objets après un
    # commit, ce qui force un rechargement SQL au premier accès à un attribut —
    # et lève DetachedInstanceError si la session est déjà fermée, cas courant
    # quand un router sérialise l'entité renvoyée par un service.
    # En désactivant l'expiration, l'objet reste lisible après commit, mais son
    # état n'est plus rafraîchi : en cas d'écriture concurrente, on peut relire
    # une valeur périmée. Quand une valeur à jour est indispensable (calcul de
    # stock, décrément de places_restantes), le service doit appeler
    # explicitement `db.refresh(objet)`.
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Classe mère de tous les modèles SQLAlchemy du projet.

    Chaque entité de ``app/models/`` hérite de cette classe. C'est son
    ``metadata`` qu'Alembic inspecte pour générer les migrations, d'où
    l'importance que tous les modèles soient importés avant l'autogénération
    (voir ``alembic/env.py``, T0.5).
    """

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def get_db() -> Generator[Session, None, None]:
    """Fournit une session SQLAlchemy le temps d'une requête HTTP.

    Destinée à être utilisée comme dépendance FastAPI (``Depends(get_db)``).
    La session est systématiquement fermée en fin de requête, y compris si le
    endpoint lève une exception. La validation (``commit``) reste à la charge
    de la couche ``services/`` : c'est elle qui connaît les frontières
    transactionnelles métier, pas cette fonction.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
