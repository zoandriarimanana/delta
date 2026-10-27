"""ajoute DOCUMENT_CONNAISSANCE pour l assistant IA

Revision ID: bb7e7128d33a
Revises: 5f032c8475f6
Create Date: 2026-10-05 09:37:08.317048

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bb7e7128d33a"
down_revision: str | Sequence[str] | None = "5f032c8475f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Base de connaissances de l'assistant IA (Sprint 12, 12.9, docs/mld.md).
    #
    # Les deux domaines formels (`type_fichier`, `public_cible`) portent leur
    # CHECK par `sa.Enum(create_constraint=True)`, comme PAIEMENT : la
    # convention de nommage le nomme `ck_document_connaissance_<nom>`.
    # L'autogeneration les avait en plus repetes en `CheckConstraint`
    # explicites — deux contraintes identiques sous deux noms, retirees a la
    # relecture.
    op.create_table(
        "document_connaissance",
        sa.Column("id_document", sa.Integer(), nullable=False),
        sa.Column("titre", sa.String(length=200), nullable=False),
        sa.Column("nom_fichier", sa.String(length=255), nullable=False),
        sa.Column(
            "type_fichier",
            sa.Enum(
                "pdf",
                "docx",
                "txt",
                "md",
                name="type_fichier_document",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("taille_octets", sa.Integer(), nullable=False),
        # Decide si le document peut ressortir dans la bulle PUBLIQUE du site.
        sa.Column(
            "public_cible",
            sa.Enum(
                "Client",
                "Personnel",
                name="public_cible_document",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        # Le texte, pas le fichier : le disque d'un service Render est efface
        # a chaque redeploiement, le texte suffit a reconstruire l'index.
        sa.Column("texte_extrait", sa.Text(), nullable=False),
        sa.Column(
            "date_ajout",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id_personnel", sa.Integer(), nullable=False),
        sa.Column("supprime_le", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "length(texte_extrait) > 0",
            name=op.f("ck_document_connaissance_texte_non_vide"),
        ),
        sa.CheckConstraint(
            "taille_octets > 0", name=op.f("ck_document_connaissance_taille_positive")
        ),
        sa.ForeignKeyConstraint(
            ["id_personnel"],
            ["personnel.id_personnel"],
            name=op.f("fk_document_connaissance_id_personnel_personnel"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id_document", name=op.f("pk_document_connaissance")),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("document_connaissance")
