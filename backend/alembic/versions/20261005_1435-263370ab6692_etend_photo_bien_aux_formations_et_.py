"""étend PHOTO_BIEN aux formations et ajoute leur description

Revision ID: 263370ab6692
Revises: e2cb623114f8
Create Date: 2026-10-05 14:35:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "263370ab6692"
down_revision: str | Sequence[str] | None = "e2cb623114f8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ANCIEN_CHECK = "(id_salle IS NOT NULL) <> (id_logement IS NOT NULL)"
NOUVEAU_CHECK = (
    "(id_salle IS NOT NULL)::int + (id_logement IS NOT NULL)::int"
    " + (id_formation IS NOT NULL)::int = 1"
)


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("formation", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("photo_bien", sa.Column("id_formation", sa.Integer(), nullable=True))
    op.create_foreign_key(
        op.f("fk_photo_bien_id_formation_formation"),
        "photo_bien",
        "formation",
        ["id_formation"],
        ["id_formation"],
        ondelete="CASCADE",
    )
    # Le XOR à deux colonnes ne sait pas compter jusqu'à trois : remplacé par
    # la somme, comme la contrainte n°2 de RESERVATION — mais `= 1`. Écrit à
    # la main : l'autogénération ne compare pas le texte des CHECK.
    op.drop_constraint(op.f("ck_photo_bien_cible_xor"), "photo_bien", type_="check")
    op.create_check_constraint(
        op.f("ck_photo_bien_cible_unique"), "photo_bien", NOUVEAU_CHECK
    )


def downgrade() -> None:
    """Downgrade schema.

    Les photos de formation sont supprimées : l'ancien CHECK ne peut pas les
    représenter.
    """
    op.execute("DELETE FROM photo_bien WHERE id_formation IS NOT NULL")
    op.drop_constraint(op.f("ck_photo_bien_cible_unique"), "photo_bien", type_="check")
    op.create_check_constraint(
        op.f("ck_photo_bien_cible_xor"), "photo_bien", ANCIEN_CHECK
    )
    op.drop_constraint(
        op.f("fk_photo_bien_id_formation_formation"), "photo_bien", type_="foreignkey"
    )
    op.drop_column("photo_bien", "id_formation")
    op.drop_column("formation", "description")
