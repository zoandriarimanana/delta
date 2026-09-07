"""ajoute PAIEMENT

Revision ID: 40335e5fc08d
Revises: 50701e647ad3
Create Date: 2026-09-07 12:37:27.881698

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "40335e5fc08d"
down_revision: str | Sequence[str] | None = "50701e647ad3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "paiement",
        sa.Column("id_paiement", sa.Integer(), nullable=False),
        sa.Column("montant", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "methode",
            sa.Enum(
                "Carte",
                "Mobile_money",
                name="methode_paiement",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "fournisseur",
            sa.Enum(
                "Mvola",
                "Orange_money",
                "Airtel_money",
                "Stripe",
                name="fournisseur_paiement",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "statut",
            sa.Enum(
                "En_attente",
                "Reussi",
                "Echoue",
                name="statut_paiement",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        # Cle de correlation du webhook simule (cf. docs/mld.md) : UNIQUE
        # globale et non partielle, une reference de transaction n'etant
        # jamais reattribuee, y compris apres archivage.
        sa.Column("reference_externe", sa.String(length=100), nullable=False),
        sa.Column(
            "date_paiement",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id_commande", sa.Integer(), nullable=False),
        sa.Column("supprime_le", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["id_commande"],
            ["commande.id_commande"],
            name=op.f("fk_paiement_id_commande_commande"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id_paiement", name=op.f("pk_paiement")),
        sa.UniqueConstraint(
            "reference_externe", name=op.f("uq_paiement_reference_externe")
        ),
    )
    # Au plus un paiement Reussi actif par commande (cf. docs/mld.md) :
    # index unique PARTIEL, meme mecanique que uq_avis_client_ligne — la
    # base tranche en cas de course entre deux paiements simultanes, le
    # service ne fait qu'un pre-controle pour produire un 409 lisible.
    op.create_index(
        "uq_paiement_commande_reussi",
        "paiement",
        ["id_commande"],
        unique=True,
        postgresql_where=sa.text("statut = 'Reussi' AND supprime_le IS NULL"),
        sqlite_where=sa.text("statut = 'Reussi' AND supprime_le IS NULL"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "uq_paiement_commande_reussi",
        table_name="paiement",
        postgresql_where=sa.text("statut = 'Reussi' AND supprime_le IS NULL"),
        sqlite_where=sa.text("statut = 'Reussi' AND supprime_le IS NULL"),
    )
    op.drop_table("paiement")
