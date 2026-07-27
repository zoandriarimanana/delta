"""Environnement Alembic — câblage sur la configuration et les modèles Delta.

Deux points structurants :

1. L'URL de connexion vient de `settings.DATABASE_URL` (donc du `.env`), pas de
   `alembic.ini` : une seule source de vérité, aucun identifiant versionné.
2. `import app.models` peuple `Base.metadata` avec les 20 entités. Sans cet
   import, l'autogénération ne voit rien : elle produirait une migration vide,
   ou pire, proposerait de supprimer les tables déjà en place.
"""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

import app.models  # noqa: F401  (peuple Base.metadata — ne jamais retirer)
from alembic import context
from app.core.config import settings
from app.core.database import Base

config = context.config

# L'URL est injectée ici plutôt que lue depuis alembic.ini.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# compare_type : détecte un changement de type de colonne.
# compare_server_default : détecte un changement de valeur par défaut côté base.
# Les deux sont désactivés par défaut dans Alembic, ce qui laisse passer ces
# évolutions sans aucune migration générée.
OPTIONS_COMPARAISON = {
    "compare_type": True,
    "compare_server_default": True,
}


def run_migrations_offline() -> None:
    """Émet le SQL sans se connecter (`alembic upgrade head --sql`)."""
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **OPTIONS_COMPARAISON,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Applique les migrations sur la base configurée."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            **OPTIONS_COMPARAISON,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
