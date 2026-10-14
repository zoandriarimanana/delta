"""photo du produit choisie par ligne de commande

`LIGNE_COMMANDE.photo_produit` (14 octobre 2026) : copie de la photo de la
galerie du produit que le client avait affichée en l'ajoutant au panier,
rangée sous `static/upload/lignes/`. Nullable : les lignes existantes, et
celles d'un produit sans photo choisie, n'en portent pas (cf. docs/mld.md).

Revision ID: 8b497d2c5f24
Revises: 46679ef760e3
Create Date: 2026-10-14 11:35:28.834391

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8b497d2c5f24"
down_revision: str | Sequence[str] | None = "46679ef760e3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "ligne_commande",
        sa.Column("photo_produit", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("ligne_commande", "photo_produit")
