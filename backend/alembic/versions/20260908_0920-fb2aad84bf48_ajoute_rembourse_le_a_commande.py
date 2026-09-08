"""ajoute rembourse_le a commande

Revision ID: fb2aad84bf48
Revises: 40335e5fc08d
Create Date: 2026-09-08 09:20:05.287715

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fb2aad84bf48"
down_revision: str | Sequence[str] | None = "40335e5fc08d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Marqueur manuel, miroir direct de supprime_le dans sa forme
    # (TIMESTAMPTZ NULL) — geste manuel simplifie (remboursement traite hors
    # systeme), pas une integration reelle remboursement<->PAIEMENT. Voir
    # docs/mld.md, section Paiement, et docs/roadmap.md (10.5).
    op.add_column(
        "commande",
        sa.Column("rembourse_le", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("commande", "rembourse_le")
