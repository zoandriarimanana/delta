"""acompte des reservations : prix figé, acompte, paiement d'une réservation

Ajoute à RESERVATION l'horodatage de création, le prix figé et l'acompte ;
PAIEMENT peut désormais régler une commande **ou** l'acompte d'une
réservation, exactement l'une des deux (13 octobre 2026, cf. docs/mld.md).

Les réservations existantes reçoivent `date_reservation = now()` et aucun
prix ni acompte : elles ne sont donc jamais concernées par l'expiration.

Revision ID: 3a59b76aebef
Revises: d5359db993d5
Create Date: 2026-10-13 17:37:56.600323

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3a59b76aebef"
down_revision: str | Sequence[str] | None = "d5359db993d5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_REUSSI_ACTIF = sa.text("statut = 'Reussi' AND supprime_le IS NULL")


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "reservation",
        sa.Column(
            "date_reservation",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.add_column(
        "reservation",
        sa.Column("montant_total", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.add_column(
        "reservation",
        sa.Column("montant_acompte", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.create_check_constraint(
        op.f("ck_reservation_acompte_coherent"),
        "reservation",
        "montant_acompte IS NULL OR (montant_total IS NOT NULL"
        " AND montant_acompte >= 0 AND montant_acompte <= montant_total)",
    )

    op.add_column("paiement", sa.Column("id_reservation", sa.Integer(), nullable=True))
    op.alter_column(
        "paiement", "id_commande", existing_type=sa.INTEGER(), nullable=True
    )
    op.create_foreign_key(
        op.f("fk_paiement_id_reservation_reservation"),
        "paiement",
        "reservation",
        ["id_reservation"],
        ["id_reservation"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "uq_paiement_reservation_reussi",
        "paiement",
        ["id_reservation"],
        unique=True,
        postgresql_where=_REUSSI_ACTIF,
        sqlite_where=_REUSSI_ACTIF,
    )
    op.create_check_constraint(
        op.f("ck_paiement_cible_paiement_unique"),
        "paiement",
        "(id_commande IS NOT NULL) <> (id_reservation IS NOT NULL)",
    )


def downgrade() -> None:
    """Downgrade schema.

    Échoue si un acompte de réservation a été payé : `id_commande` ne peut
    pas redevenir obligatoire tant qu'une ligne n'en porte pas. C'est voulu —
    effacer silencieusement des paiements ne serait pas une marche arrière.
    """
    op.drop_constraint(
        op.f("ck_paiement_cible_paiement_unique"), "paiement", type_="check"
    )
    op.drop_index(
        "uq_paiement_reservation_reussi",
        table_name="paiement",
        postgresql_where=_REUSSI_ACTIF,
        sqlite_where=_REUSSI_ACTIF,
    )
    op.drop_constraint(
        op.f("fk_paiement_id_reservation_reservation"), "paiement", type_="foreignkey"
    )
    op.alter_column(
        "paiement", "id_commande", existing_type=sa.INTEGER(), nullable=False
    )
    op.drop_column("paiement", "id_reservation")

    op.drop_constraint(
        op.f("ck_reservation_acompte_coherent"), "reservation", type_="check"
    )
    op.drop_column("reservation", "montant_acompte")
    op.drop_column("reservation", "montant_total")
    op.drop_column("reservation", "date_reservation")
