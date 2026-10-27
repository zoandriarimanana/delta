"""durcit AVIS : coherence du type et unicite par cible

Revision ID: 50701e647ad3
Revises: 7449799a3ada
Create Date: 2026-09-04 15:57:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "50701e647ad3"
down_revision: str | Sequence[str] | None = "7449799a3ada"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # ECRITE A LA MAIN : l'autogeneration d'Alembic ne compare pas les CHECK,
    # meme traitement que tarif_selon_facturation (17b094b07f7a). Ne croise
    # aucune autre table : type_avis, id_ligne et id_reservation vivent tous
    # sur AVIS, combinee a cible_xor (deja en place) cette seule equivalence
    # suffit a garantir les deux sens (cf. docs/mld.md).
    op.create_check_constraint(
        "type_coherent_avec_cible",
        "avis",
        "(type_avis = 'Produit') = (id_ligne IS NOT NULL)",
    )

    # Index uniques PARTIELS, et non contraintes UNIQUE globales : un avis
    # retire pour moderation (archive) doit pouvoir etre remplace par un
    # nouveau, contrairement a LIVRAISON.#id_commande qui n'est jamais
    # reattribuee. Meme raisonnement que uq_beneficiaire_identifiant_badge
    # (ce64eca5e1d3).
    op.create_index(
        "uq_avis_client_ligne",
        "avis",
        ["id_client", "id_ligne"],
        unique=True,
        postgresql_where=sa.text("supprime_le IS NULL AND id_ligne IS NOT NULL"),
        sqlite_where=sa.text("supprime_le IS NULL AND id_ligne IS NOT NULL"),
    )
    op.create_index(
        "uq_avis_client_reservation",
        "avis",
        ["id_client", "id_reservation"],
        unique=True,
        postgresql_where=sa.text("supprime_le IS NULL AND id_reservation IS NOT NULL"),
        sqlite_where=sa.text("supprime_le IS NULL AND id_reservation IS NOT NULL"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("uq_avis_client_reservation", table_name="avis")
    op.drop_index("uq_avis_client_ligne", table_name="avis")
    op.drop_constraint("type_coherent_avec_cible", "avis", type_="check")
