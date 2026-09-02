"""commande porte le personnel qui l a saisie

Revision ID: 0343d5f4ac9e
Revises: 90500366dbfd
Create Date: 2026-09-02 13:05:00.000000

Ajoute `COMMANDE.id_personnel` : le salarie qui a saisi la commande au
comptoir ou a table.

`NULL` a un sens precis et unique — **la commande vient du parcours client**,
passee par le client lui-meme. C'est le cas de toutes les commandes
existantes, et il reste le cas courant. Une valeur ne peut venir que de
`POST /commandes/personnel`.

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0343d5f4ac9e"
down_revision: str | Sequence[str] | None = "90500366dbfd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Nullable, et sans valeur par defaut : les commandes existantes restent a
    # NULL, ce qui est exact — elles ont bien ete passees par leurs clients.
    # Poser une valeur par defaut inventerait un salarie qui n'a rien saisi.
    op.add_column("commande", sa.Column("id_personnel", sa.Integer(), nullable=True))

    # ON DELETE RESTRICT : un salarie ne s'efface pas, il s'anonymise
    # (`PersonnelService.anonymiser`). La commande garde alors un identifiant
    # devenu anonyme, comme les livraisons et les sessions de formation. Un
    # CASCADE effacerait des commandes — donc des preuves de transaction — pour
    # le depart d'un salarie.
    op.create_foreign_key(
        op.f("fk_commande_id_personnel_personnel"),
        "commande",
        "personnel",
        ["id_personnel"],
        ["id_personnel"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        op.f("fk_commande_id_personnel_personnel"), "commande", type_="foreignkey"
    )
    op.drop_column("commande", "id_personnel")
