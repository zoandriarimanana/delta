"""ouverture internationale : TAUX_CHANGE, devise des commandes et paiements, pays

Revision ID: d5359db993d5
Revises: 3af6d3fff70c
Create Date: 2026-10-08 12:14:27.938894

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5359db993d5"
down_revision: str | Sequence[str] | None = "3af6d3fff70c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEVISES = ("MGA", "EUR", "USD")


def _devise(nom: str) -> sa.Enum:
    # `create_constraint=False` sur les colonnes ajoutées : `add_column` ne
    # pose pas le CHECK d'un Enum non natif, il est donc créé explicitement
    # ci-dessous, sous le nom que la convention de nommage lui donne.
    return sa.Enum(*DEVISES, name=nom, native_enum=False, create_constraint=False)


def upgrade() -> None:
    """Upgrade schema."""
    # Ouverture internationale (demande du 8 octobre 2026, docs/mld.md) :
    # paiement réel en devise, taux réglés par l'administrateur.
    taux = op.create_table(
        "taux_change",
        sa.Column("id_taux", sa.Integer(), nullable=False),
        sa.Column(
            "devise",
            sa.Enum(
                *DEVISES, name="devise_taux", native_enum=False, create_constraint=True
            ),
            nullable=False,
        ),
        sa.Column(
            "ariary_par_unite", sa.Numeric(precision=14, scale=4), nullable=False
        ),
        sa.Column(
            "mis_a_jour_le",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("supprime_le", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "devise <> 'MGA'", name=op.f("ck_taux_change_pas_de_taux_pour_l_ariary")
        ),
        sa.CheckConstraint(
            "ariary_par_unite > 0",
            name=op.f("ck_taux_change_taux_strictement_positif"),
        ),
        sa.PrimaryKeyConstraint("id_taux", name=op.f("pk_taux_change")),
        sa.UniqueConstraint("devise", name=op.f("uq_taux_change_devise")),
    )
    # Valeurs de départ, à ajuster par l'administrateur : aucun endpoint ne
    # crée de devise, la liste est fermée (docs/mld.md).
    op.bulk_insert(
        taux,
        [
            {"devise": "EUR", "ariary_par_unite": "5000.0000"},
            {"devise": "USD", "ariary_par_unite": "4500.0000"},
        ],
    )

    op.add_column(
        "client_entreprise",
        sa.Column("pays", sa.String(length=2), server_default="MG", nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_client_entreprise_pays_code_iso"),
        "client_entreprise",
        "length(pays) = 2 AND pays = upper(pays)",
    )

    op.add_column(
        "commande",
        sa.Column(
            "devise", _devise("devise_commande"), server_default="MGA", nullable=False
        ),
    )
    op.add_column(
        "commande",
        sa.Column(
            "taux_change",
            sa.Numeric(precision=14, scale=4),
            server_default="1",
            nullable=False,
        ),
    )
    op.add_column(
        "commande",
        sa.Column(
            "montant_total_devise",
            sa.Numeric(precision=12, scale=2),
            server_default="0",
            nullable=False,
        ),
    )
    # Les commandes existantes sont toutes en Ariary, au taux 1 : leur
    # montant dans la devise est leur montant tout court.
    op.execute("UPDATE commande SET montant_total_devise = montant_total")
    op.create_check_constraint(
        op.f("ck_commande_devise_commande"),
        "commande",
        "devise IN ('MGA', 'EUR', 'USD')",
    )
    op.create_check_constraint(
        op.f("ck_commande_taux_coherent_avec_devise"),
        "commande",
        "devise <> 'MGA' OR taux_change = 1",
    )
    op.create_check_constraint(
        op.f("ck_commande_taux_strictement_positif"), "commande", "taux_change > 0"
    )

    op.add_column(
        "paiement",
        sa.Column(
            "devise", _devise("devise_paiement"), server_default="MGA", nullable=False
        ),
    )
    op.create_check_constraint(
        op.f("ck_paiement_devise_paiement"),
        "paiement",
        "devise IN ('MGA', 'EUR', 'USD')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f("ck_paiement_devise_paiement"), "paiement", type_="check")
    op.drop_column("paiement", "devise")
    op.drop_constraint(
        op.f("ck_commande_taux_strictement_positif"), "commande", type_="check"
    )
    op.drop_constraint(
        op.f("ck_commande_taux_coherent_avec_devise"), "commande", type_="check"
    )
    op.drop_constraint(op.f("ck_commande_devise_commande"), "commande", type_="check")
    op.drop_column("commande", "montant_total_devise")
    op.drop_column("commande", "taux_change")
    op.drop_column("commande", "devise")
    op.drop_constraint(
        op.f("ck_client_entreprise_pays_code_iso"), "client_entreprise", type_="check"
    )
    op.drop_column("client_entreprise", "pays")
    op.drop_table("taux_change")
