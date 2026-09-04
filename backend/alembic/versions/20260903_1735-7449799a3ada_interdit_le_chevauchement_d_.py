"""interdit le chevauchement d'abonnements actifs sur une même entreprise

Revision ID: 7449799a3ada
Revises: 17b094b07f7a
Create Date: 2026-09-03 17:35:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7449799a3ada"
down_revision: str | Sequence[str] | None = "17b094b07f7a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CONTRAINTE = "abonnement_sans_chevauchement"


def upgrade() -> None:
    """Upgrade schema."""
    # ECRITE A LA MAIN : l'autogeneration d'Alembic ne compare pas les
    # contraintes d'exclusion, comme elle ne compare pas les CHECK. Meme
    # traitement que acadf9ddce27 (RESERVATION sur SALLE/LOGEMENT).
    #
    # `btree_gist` est deja creee par acadf9ddce27, plus haut dans la chaine de
    # migrations : pas besoin de la recreer ici.
    #
    # `daterange(date_debut, date_fin)` a des bornes [) : un renouvellement qui
    # commence le jour ou l'ancien abonnement se termine n'est pas un
    # chevauchement.
    #
    # Echouerait sur une base contenant deja deux abonnements actifs qui se
    # recoupent pour la meme entreprise. Aucun n'existe : ABONNEMENT n'avait ni
    # service ni router avant 7.1.1, aucune ligne n'a pu etre creee via l'API.
    op.execute(
        f"ALTER TABLE abonnement ADD CONSTRAINT {CONTRAINTE}"
        f" EXCLUDE USING gist (id_client_entreprise WITH =,"
        f" daterange(date_debut, date_fin) WITH &&)"
        f" WHERE (supprime_le IS NULL)"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(f"ALTER TABLE abonnement DROP CONSTRAINT IF EXISTS {CONTRAINTE}")
