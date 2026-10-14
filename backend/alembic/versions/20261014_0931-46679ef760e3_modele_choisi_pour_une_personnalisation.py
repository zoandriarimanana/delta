"""modele choisi pour une personnalisation : DEMANDE_PERSONNALISATION.photo_modele

Nom de la copie du modèle choisi par le client parmi les exemples de la
catégorie (14 octobre 2026, cf. docs/mld.md). Nullable, aucune donnée touchée.

Revision ID: 46679ef760e3
Revises: 8303122daf72
Create Date: 2026-10-14 09:31:11.323359

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "46679ef760e3"
down_revision: str | Sequence[str] | None = "8303122daf72"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "demande_personnalisation",
        sa.Column("photo_modele", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("demande_personnalisation", "photo_modele")
