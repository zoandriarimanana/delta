"""demande de formation sur commande : table DEMANDE_FORMATION

Formation qui n'est pas au catalogue, demandée par un visiteur avec ou sans
compte et suivie par l'administration (14 octobre 2026, cf. docs/mld.md).
Table nouvelle, aucune donnée existante touchée.

Revision ID: 8303122daf72
Revises: 3a59b76aebef
Create Date: 2026-10-14 09:03:59.310474

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8303122daf72"
down_revision: str | Sequence[str] | None = "3a59b76aebef"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "demande_formation",
        sa.Column("id_demande", sa.Integer(), nullable=False),
        sa.Column("sujet", sa.String(length=200), nullable=False),
        sa.Column("nombre_participants", sa.Integer(), nullable=False),
        sa.Column("niveau", sa.String(length=100), nullable=True),
        sa.Column("periode_souhaitee", sa.String(length=200), nullable=True),
        sa.Column(
            "lieu",
            sa.Enum(
                "Chez_delta",
                "En_entreprise",
                "Indifferent",
                name="lieu_formation",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="Indifferent",
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("nom_contact", sa.String(length=150), nullable=False),
        sa.Column("contact", sa.String(length=150), nullable=False),
        sa.Column(
            "statut",
            sa.Enum(
                "Nouvelle",
                "En_discussion",
                "Planifiee",
                "Refusee",
                name="statut_demande_formation",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="Nouvelle",
            nullable=False,
        ),
        sa.Column("note_interne", sa.Text(), nullable=True),
        sa.Column(
            "date_demande",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id_client", sa.Integer(), nullable=True),
        sa.Column("supprime_le", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "nombre_participants >= 1",
            name=op.f("ck_demande_formation_participants_positif"),
        ),
        sa.ForeignKeyConstraint(
            ["id_client"],
            ["client.id_client"],
            name=op.f("fk_demande_formation_id_client_client"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id_demande", name=op.f("pk_demande_formation")),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("demande_formation")
