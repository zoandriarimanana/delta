"""durcit ABONNEMENT (date_fin, tarifs) et le domaine de statut BENEFICIAIRE

Revision ID: 17b094b07f7a
Revises: 0343d5f4ac9e
Create Date: 2026-09-03 16:18:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "17b094b07f7a"
down_revision: str | Sequence[str] | None = "0343d5f4ac9e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUTS_BENEFICIAIRE = ("Actif", "Inactif", "Suspendu")


def _domaine_statut_beneficiaire() -> sa.Enum:
    return sa.Enum(
        *STATUTS_BENEFICIAIRE,
        name="statut_beneficiaire",
        native_enum=False,
        create_constraint=True,
    )


def upgrade() -> None:
    """Upgrade schema."""
    # Sprint 7 (7.1.1) n'a encore ni service ni router pour ABONNEMENT et
    # BENEFICIAIRE : aucune ligne n'a pu etre creee via l'API. Ecrite a la main,
    # comme les migrations de CHECK precedentes (5b62294f6958, 22127cdc2dce) —
    # l'autogeneration ne compare pas les contraintes CHECK et le comparateur
    # d'Alembic est desactive sur les sa.Enum dans env.py.

    # date_fin devient obligatoire : un abonnement B2B a une echeance
    # contractuelle, contrairement a RESERVATION dont certains types n'ont pas
    # de borne fixee a priori. Aucune ligne existante a convertir (voir ci-dessus).
    op.alter_column(
        "abonnement",
        "date_fin",
        existing_type=sa.Date(),
        nullable=False,
    )

    # Coherence chronologique : une fin avant le debut n'a pas de sens.
    op.create_check_constraint(
        "dates_coherentes",
        "abonnement",
        "date_fin > date_debut",
    )

    # Le tarif correspondant au type de facturation choisi doit etre renseigne.
    # Meme pattern que ck_produit_tarif_selon_personnalisation
    # (PRODUIT.supplement_personnalisation, cf. docs/mld.md) : une implication,
    # pas une equivalence — l'autre tarif peut rester dormant.
    op.create_check_constraint(
        "tarif_selon_facturation",
        "abonnement",
        "(type_facturation = 'Forfait' AND tarif_forfait IS NOT NULL) "
        "OR (type_facturation = 'Consommation_reelle' AND tarif_unitaire_repas IS NOT NULL)",
    )

    # BENEFICIAIRE.statut : chaine libre au Sprint 0 ("le MLD n'en fixe pas le
    # domaine") vers domaine formel, decide en construisant le Sprint 7. Meme
    # mecanique qu'aux migrations 7d77916d25f0 (SESSION_FORMATION) et
    # fdc25d096467 (RESERVATION) : alter_column avec create_constraint=True
    # pose le CHECK du domaine.
    op.alter_column(
        "beneficiaire",
        "statut",
        existing_type=sa.VARCHAR(length=30),
        type_=_domaine_statut_beneficiaire(),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "beneficiaire",
        "statut",
        existing_type=_domaine_statut_beneficiaire(),
        type_=sa.VARCHAR(length=30),
        existing_nullable=False,
    )

    op.drop_constraint("tarif_selon_facturation", "abonnement", type_="check")
    op.drop_constraint("dates_coherentes", "abonnement", type_="check")

    op.alter_column(
        "abonnement",
        "date_fin",
        existing_type=sa.Date(),
        nullable=True,
    )
