"""ajoute TARIF_LIVRAISON et COMMANDE.frais_livraison

Revision ID: 68afc4891578
Revises: 4e4ce0aaf1ea
Create Date: 2026-10-07 11:36:32.639240

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "68afc4891578"
down_revision: str | Sequence[str] | None = "4e4ce0aaf1ea"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Frais de livraison (demande du 7 octobre 2026, docs/mld.md) : forfait
    # unique, une fois par commande, offert au-delà d'un seuil, réglable par
    # l'administrateur.
    tarif = op.create_table(
        "tarif_livraison",
        sa.Column("id_tarif", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("forfait", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("seuil_gratuite", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("supprime_le", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "forfait >= 0", name=op.f("ck_tarif_livraison_forfait_positif")
        ),
        sa.CheckConstraint(
            "id_tarif = 1", name=op.f("ck_tarif_livraison_ligne_unique")
        ),
        sa.CheckConstraint(
            "seuil_gratuite IS NULL OR seuil_gratuite > 0",
            name=op.f("ck_tarif_livraison_seuil_strictement_positif"),
        ),
        sa.PrimaryKeyConstraint("id_tarif", name=op.f("pk_tarif_livraison")),
    )
    # L'unique ligne, posée ici et nulle part ailleurs : aucun endpoint ne la
    # crée. Valeurs de départ, modifiables ensuite par l'administrateur.
    op.bulk_insert(
        tarif, [{"id_tarif": 1, "forfait": "5000.00", "seuil_gratuite": "100000.00"}]
    )
    # `server_default` 0 : les commandes existantes n'ont jamais payé de
    # livraison — leur `montant_total` reste juste tel quel.
    op.add_column(
        "commande",
        sa.Column(
            "frais_livraison",
            sa.Numeric(precision=10, scale=2),
            server_default="0",
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("commande", "frais_livraison")
    op.drop_table("tarif_livraison")
