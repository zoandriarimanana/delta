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
#
# Le comparateur de contraintes CHECK est en revanche **désactivé**. Introduit
# par Alembic 1.19, il ne sait pas rapprocher une contrainte issue d'un
# `sa.Enum(create_constraint=True)` de son équivalent en base : côté modèle,
# l'expression reste un paramètre non rendu (`IN (__[POSTCOMPILE_param_1])`)
# là où PostgreSQL stocke la liste développée. Il conclut donc à la suppression
# de huit contraintes qui sont bel et bien présentes des deux côtés, sous le
# même nom — un faux positif intégral, qui rendait `alembic check` rouge sur
# toute branche.
#
# Ce n'est pas une régression de couverture : Alembic n'a **jamais** comparé les
# CHECK avant 1.19. C'est précisément pourquoi `ck_commande_client_ou_invite` a
# dû être écrite à la main dans sa migration, avec un commentaire le disant.
# Les contraintes CHECK restent donc, comme avant, la responsabilité de qui
# écrit la migration.
#
# Tables du vector store de l'assistant IA (Sprint 12) : créées et gérées par
# `langchain-postgres`, qui les fait évoluer avec sa propre version. Aucun
# modèle ne les déclare — sans ce filtre, `alembic check` conclurait qu'il faut
# les supprimer, et une autogénération proposerait de le faire. L'extension
# `vector` dont elles dépendent, elle, est bien créée par une migration.
PREFIXE_TABLES_HORS_MLD = "langchain_pg_"


def inclure_objet(objet, nom, type_, reflete, compare_a) -> bool:
    """Écarte de la comparaison les tables gérées hors d'Alembic."""
    if type_ == "table" and reflete and compare_a is None:
        return not (nom or "").startswith(PREFIXE_TABLES_HORS_MLD)
    return True


OPTIONS_COMPARAISON = {
    "compare_type": True,
    "compare_server_default": True,
    "include_object": inclure_objet,
    "autogenerate_plugins": [
        "alembic.autogenerate.*",
        "~alembic.autogenerate.checkconstraint_byname",
    ],
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
