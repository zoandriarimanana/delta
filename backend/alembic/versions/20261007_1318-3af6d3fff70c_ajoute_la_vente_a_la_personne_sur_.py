"""ajoute la vente à la personne sur PRODUIT

Revision ID: 3af6d3fff70c
Revises: 68afc4891578
Create Date: 2026-10-07 13:18:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3af6d3fff70c"
down_revision: str | Sequence[str] | None = "68afc4891578"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Vente au nombre de personnes (demande du 7 octobre 2026, docs/mld.md).
    # `server_default` false : tous les produits existants restent vendus à
    # l'unité, sans changement.
    op.add_column(
        "produit",
        sa.Column(
            "vendu_par_personne",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
    )
    op.add_column("produit", sa.Column("personnes_min", sa.Integer(), nullable=True))
    # Écrit à la main : l'autogénération ne détecte pas les CHECK.
    op.create_check_constraint(
        op.f("ck_produit_vendu_par_personne_a_un_minimum"),
        "produit",
        "(personnes_min IS NULL OR personnes_min >= 1)"
        " AND (NOT vendu_par_personne OR personnes_min IS NOT NULL)",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        op.f("ck_produit_vendu_par_personne_a_un_minimum"), "produit", type_="check"
    )
    op.drop_column("produit", "personnes_min")
    op.drop_column("produit", "vendu_par_personne")
