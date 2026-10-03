"""active l extension vector pour l assistant IA

Revision ID: 5f032c8475f6
Revises: 0213496fcc1b
Create Date: 2026-10-03 16:55:51.860899

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5f032c8475f6"
down_revision: str | Sequence[str] | None = "0213496fcc1b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # pgvector porte le type `vector` et la recherche par similarite de
    # l'assistant IA (Sprint 12). L'extension est creee ICI, par une migration,
    # et non par `langchain-postgres` (`create_extension=False` cote module) :
    # une modification du schema passe par Alembic, jamais par un effet de bord
    # au premier appel d'une bibliotheque.
    #
    # Les deux tables du vector store (`langchain_pg_collection`,
    # `langchain_pg_embedding`) ne sont en revanche PAS creees ici : leur schema
    # suit la version de `langchain-postgres`, pas une decision metier. Elles
    # sont exclues de la comparaison dans `alembic/env.py` — voir docs/mld.md.
    #
    # `IF NOT EXISTS` : meme raisonnement que `btree_gist` (#47) — l'extension
    # peut deja etre presente. Contrairement a `btree_gist`, `vector` n'est PAS
    # *trusted* (verifie sur `pgvector/pgvector:pg16`, `vector.control` 0.8.7) :
    # il faut un role proprietaire de la base ou superutilisateur. C'est le cas
    # du conteneur de developpement et de la CI ; Render l'autorise au role
    # proprietaire de ses bases (documentation Render, PostgreSQL >= 13).
    #
    # Sur une image sans pgvector (`postgres:16-alpine`), cette ligne echoue :
    # c'est voulu, l'assistant ne peut pas fonctionner sans elle.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")


def downgrade() -> None:
    """Downgrade schema."""
    # `CASCADE` supprime la colonne `embedding` de `langchain_pg_embedding`,
    # qui depend du type `vector` — pas les tables elles-memes, constate en
    # rejouant downgrade puis upgrade. Sans consequence : l'index est
    # reconstructible a tout moment depuis la base metier
    # (`scripts/reindexer_assistant.py`, 12.3), il ne porte aucune donnee
    # d'origine.
    op.execute("DROP EXTENSION IF EXISTS vector CASCADE")
