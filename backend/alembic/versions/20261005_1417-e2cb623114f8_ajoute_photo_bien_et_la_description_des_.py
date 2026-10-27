"""ajoute PHOTO_BIEN et la description des salles et logements

Revision ID: e2cb623114f8
Revises: bb7e7128d33a
Create Date: 2026-10-05 14:17:13.231214

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e2cb623114f8"
down_revision: str | Sequence[str] | None = "bb7e7128d33a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Galerie des salles et logements (docs/mld.md, PHOTO_BIEN). Octets en
    # base et non sur disque : le disque Render est effacé au redéploiement.
    #
    # Le domaine `format` porte son CHECK par `sa.Enum(create_constraint=True)`
    # (`ck_photo_bien_format_photo`). L'autogénération l'avait en plus répété
    # en `CheckConstraint` explicite, sous deux noms — retiré à la relecture,
    # comme pour DOCUMENT_CONNAISSANCE.
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
        sa.Column("supprime_le", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(id_salle IS NOT NULL) <> (id_logement IS NOT NULL)",
            name=op.f("ck_photo_bien_cible_xor"),
        ),
        sa.CheckConstraint(
            "taille_octets > 0", name=op.f("ck_photo_bien_taille_positive")
        ),
        sa.ForeignKeyConstraint(
            ["id_logement"],
            ["logement.id_logement"],
            name=op.f("fk_photo_bien_id_logement_logement"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_salle"],
            ["salle.id_salle"],
            name=op.f("fk_photo_bien_id_salle_salle"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_photo", name=op.f("pk_photo_bien")),
    )
    op.add_column("logement", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("salle", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("salle", "description")
    op.drop_column("logement", "description")
    op.drop_table("photo_bien")
