"""retire PHOTO_BIEN au profit du stockage disque

Revision ID: 4e4ce0aaf1ea
Revises: 263370ab6692
Create Date: 2026-10-05 17:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4e4ce0aaf1ea"
down_revision: str | Sequence[str] | None = "263370ab6692"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema.

    Décision de l'utilisateur (5 octobre 2026) : les photos du catalogue sont
    rangées sur disque, dans `static/upload/<partie>/<id>-<n>.<ext>`, et non
    plus en base. Les photos déjà en base sont **abandonnées**, délibérément —
    il ne s'agissait que de photos de test. Les colonnes `description` de
    SALLE, LOGEMENT et FORMATION sont conservées.
    """
    op.drop_table("photo_bien")


def downgrade() -> None:
    """Downgrade schema — recrée la table vide, dans son dernier état."""
    op.create_table(
        "photo_bien",
        sa.Column("id_photo", sa.Integer(), nullable=False),
        sa.Column("contenu", sa.LargeBinary(), nullable=False),
        sa.Column(
            "format",
            sa.Enum(
                "JPEG",
                "PNG",
                "WEBP",
                name="format_photo",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("taille_octets", sa.Integer(), nullable=False),
        sa.Column("legende", sa.String(length=200), nullable=True),
        sa.Column(
            "date_ajout",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id_salle", sa.Integer(), nullable=True),
        sa.Column("id_logement", sa.Integer(), nullable=True),
        sa.Column("id_formation", sa.Integer(), nullable=True),
        sa.Column("supprime_le", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(id_salle IS NOT NULL)::int + (id_logement IS NOT NULL)::int"
            " + (id_formation IS NOT NULL)::int = 1",
            name=op.f("ck_photo_bien_cible_unique"),
        ),
        sa.CheckConstraint(
            "taille_octets > 0", name=op.f("ck_photo_bien_taille_positive")
        ),
        sa.ForeignKeyConstraint(
            ["id_salle"],
            ["salle.id_salle"],
            name=op.f("fk_photo_bien_id_salle_salle"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_logement"],
            ["logement.id_logement"],
            name=op.f("fk_photo_bien_id_logement_logement"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_formation"],
            ["formation.id_formation"],
            name=op.f("fk_photo_bien_id_formation_formation"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_photo", name=op.f("pk_photo_bien")),
    )
