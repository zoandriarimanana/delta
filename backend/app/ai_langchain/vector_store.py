"""Index vectoriel de l'assistant : PGVector (langchain-postgres).

Les tables `langchain_pg_collection` et `langchain_pg_embedding` sont gérées
par la bibliothèque, hors MLD et hors Alembic — voir `docs/mld.md`, section
« Hors MLD ». L'extension `vector` dont elles dépendent est créée par une
migration, d'où `create_extension=False` ci-dessous.

Chaque fragment indexé porte deux métadonnées, qui disent d'où il vient :
`type_contenu` (« produit », « formation »...) et `id_contenu` (la clé primaire
de l'entité). C'est ce qui permet de réindexer ou de retirer une entité seule,
et de renvoyer au client un lien vers la fiche source.
"""

import json
from functools import lru_cache

from langchain_core.embeddings import Embeddings
from langchain_postgres import PGVector
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine

NOM_COLLECTION = "delta_catalogue_v1"

PREFIXES_PSYCOPG3 = ("postgresql+psycopg2://", "postgresql://", "postgres://")


def url_psycopg3(url: str) -> str:
    """Adapte `DATABASE_URL` au driver psycopg 3 qu'exige langchain-postgres.

    Le reste de l'application passe par psycopg2 (`postgresql+psycopg2://`).
    Le module d'origine ne convertissait que `postgresql://` : l'URL de Delta
    lui serait arrivée inchangée, avec le mauvais driver. `postgres://` est la
    forme que fournit Render.
    """
    for prefixe in PREFIXES_PSYCOPG3:
        if url.startswith(prefixe):
            return "postgresql+psycopg://" + url.removeprefix(prefixe)
    return url


def creer_vector_store(embeddings: Embeddings, collection: str) -> PGVector:
    """Construit un store sur une collection donnée — sans cache.

    Séparé de `obtenir_vector_store()` pour que les tests puissent travailler
    sur leur propre collection, avec de faux embeddings, sans toucher à celle
    de l'application ni appeler Hugging Face.
    """
    return PGVector(
        embeddings=embeddings,
        collection_name=collection,
        connection=url_psycopg3(settings.DATABASE_URL),
        use_jsonb=True,
        create_extension=False,
    )


@lru_cache(maxsize=1)
def obtenir_vector_store() -> PGVector:
    """Store de l'application, créé une seule fois.

    Mis en cache : PGVector tient son propre pool de connexions, le recréer à
    chaque question ouvrirait une connexion par requête.
    """
    from app.ai_langchain.embeddings import obtenir_embeddings

    return creer_vector_store(obtenir_embeddings(), NOM_COLLECTION)


def _tables_existent(connexion) -> bool:
    """Les tables n'existent qu'après la première indexation."""
    requete = text("SELECT to_regclass('langchain_pg_embedding')")
    return connexion.execute(requete).scalar() is not None


def supprimer_par_contenu(
    type_contenu: str,
    id_contenu: int | None = None,
    collection: str = NOM_COLLECTION,
) -> int:
    """Retire les fragments d'un type de contenu, ou d'une seule entité.

    SQL direct : PGVector ne propose pas de suppression par filtre de
    métadonnées. Filtre par **inclusion JSON** (`@>`) plutôt que par
    extraction (`->>`) : la bibliothèque pose un index GIN sur `cmetadata`,
    que seule l'inclusion sait utiliser.
    """
    filtre: dict[str, str | int] = {"type_contenu": type_contenu}
    if id_contenu is not None:
        filtre["id_contenu"] = id_contenu

    with engine.begin() as connexion:
        if not _tables_existent(connexion):
            return 0
        resultat = connexion.execute(
            text(
                "DELETE FROM langchain_pg_embedding"
                " WHERE collection_id = ("
                "   SELECT uuid FROM langchain_pg_collection WHERE name = :collection)"
                " AND cmetadata @> CAST(:filtre AS jsonb)"
            ),
            {"collection": collection, "filtre": json.dumps(filtre)},
        )
        return resultat.rowcount


def compter_par_contenu(
    type_contenu: str, collection: str = NOM_COLLECTION
) -> dict[int, int]:
    """Nombre de fragments par entité d'un type — pour l'administration."""
    with engine.connect() as connexion:
        if not _tables_existent(connexion):
            return {}
        lignes = connexion.execute(
            text(
                "SELECT (cmetadata->>'id_contenu')::int, COUNT(*)"
                " FROM langchain_pg_embedding"
                " WHERE collection_id = ("
                "   SELECT uuid FROM langchain_pg_collection WHERE name = :collection)"
                " AND cmetadata @> CAST(:filtre AS jsonb)"
                " GROUP BY 1"
            ),
            {
                "collection": collection,
                "filtre": json.dumps({"type_contenu": type_contenu}),
            },
        ).all()
    return {id_contenu: nombre for id_contenu, nombre in lignes}


def statistiques(collection: str = NOM_COLLECTION) -> dict[str, int]:
    """Nombre de fragments indexés, par type de contenu."""
    with engine.connect() as connexion:
        if not _tables_existent(connexion):
            return {}
        lignes = connexion.execute(
            text(
                "SELECT cmetadata->>'type_contenu', COUNT(*)"
                " FROM langchain_pg_embedding"
                " WHERE collection_id = ("
                "   SELECT uuid FROM langchain_pg_collection WHERE name = :collection)"
                " GROUP BY cmetadata->>'type_contenu'"
            ),
            {"collection": collection},
        ).all()
    return {type_contenu: nombre for type_contenu, nombre in lignes}
