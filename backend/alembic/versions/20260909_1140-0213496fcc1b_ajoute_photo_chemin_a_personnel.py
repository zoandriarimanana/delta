"""ajoute photo_chemin a personnel

Revision ID: 0213496fcc1b
Revises: 4cfa278b3371
Create Date: 2026-09-09 11:40:20.481598

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0213496fcc1b"
down_revision: str | Sequence[str] | None = "4cfa278b3371"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Nom de fichier genere (UUID + extension), jamais un chemin absolu ni le
    # nom d'origine envoye par le client. NULL signifie "pas de photo" -
    # l'avatar generique s'affiche cote frontend. Voir docs/mld.md.
    op.add_column(
        "personnel", sa.Column("photo_chemin", sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("personnel", "photo_chemin")
