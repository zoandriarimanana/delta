"""ajoute le CHECK au_moins_un_tarif sur salle

Revision ID: 5b62294f6958
Revises: fdc25d096467
Create Date: 2026-08-22 18:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5b62294f6958"
down_revision: str | Sequence[str] | None = "fdc25d096467"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # ECRITE A LA MAIN : l'autogeneration ne compare pas les contraintes CHECK,
    # et le comparateur d'Alembic 1.19 est desactive dans `env.py` (faux
    # positifs sur les `sa.Enum`). Meme traitement que
    # `ck_commande_client_ou_invite` et `ck_produit_personnalisable_a_un_supplement`.
    #
    # Regle du dictionnaire de donnees d'origine, jamais portee en contrainte
    # jusqu'ici. Ce n'est pas une regle nouvelle : voir `docs/mld.md`.
    #
    # Echouerait sur une base contenant deja une salle sans aucun tarif.
    # Verifie au moment d'ecrire la migration : aucune n'existe. Si le cas se
    # presentait, l'echec serait le bon comportement — il faudrait fixer un
    # tarif, pas en inventer un ici.
    op.create_check_constraint(
        "au_moins_un_tarif",
        "salle",
        "tarif_horaire IS NOT NULL OR tarif_journee IS NOT NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Le nom passe ici est **nu**, sans prefixe : la convention de nommage de
    # `core/database.py` le complete en `ck_salle_...`. Passer le nom complet
    # produirait `ck_salle_ck_salle_...` et un echec au downgrade — bug attrape
    # par l'aller-retour lors de la migration 22127cdc2dce.
    op.drop_constraint("au_moins_un_tarif", "salle", type_="check")
