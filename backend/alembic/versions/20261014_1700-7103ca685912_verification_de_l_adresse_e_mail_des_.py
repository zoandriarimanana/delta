"""vérification de l'adresse e-mail des clients

Ajoute à CLIENT l'horodatage de vérification, l'empreinte du code en cours,
son échéance et le nombre d'essais (14 octobre 2026, cf. docs/mld.md).
`email_verifie_le` a pour défaut `now()` : tous les comptes existants sont
donc marqués vérifiés, et personne n'est bloqué à la connexion. Seule
l'inscription par l'API pose `NULL` et envoie un code.

Revision ID: 7103ca685912
Revises: 8b497d2c5f24
Create Date: 2026-10-14 17:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7103ca685912"
down_revision: str | Sequence[str] | None = "8b497d2c5f24"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "client",
        sa.Column(
            "email_verifie_le",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
    )
    op.add_column(
        "client", sa.Column("code_verification", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "client",
        sa.Column("code_expire_le", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "client",
        sa.Column(
            "essais_code", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("client", "essais_code")
    op.drop_column("client", "code_expire_le")
    op.drop_column("client", "code_verification")
    op.drop_column("client", "email_verifie_le")
