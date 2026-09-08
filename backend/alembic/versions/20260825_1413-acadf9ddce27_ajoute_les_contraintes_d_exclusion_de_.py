"""ajoute les contraintes d exclusion de chevauchement

Revision ID: acadf9ddce27
Revises: 243c2f092c7b
Create Date: 2026-08-25 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "acadf9ddce27"
down_revision: str | Sequence[str] | None = "243c2f092c7b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Une reservation annulee libere son creneau, une reservation archivee n'existe
# plus pour les lectures courantes : ni l'une ni l'autre ne doit bloquer le bien.
# Sans ce predicat, une annulation condamnerait le creneau a jamais — meme
# raisonnement que la restitution des places en #41.
PREDICAT = "supprime_le IS NULL AND statut <> 'Annulee'"

CONTRAINTES = (
    ("salle_sans_chevauchement", "id_salle"),
    ("logement_sans_chevauchement", "id_logement"),
)


def upgrade() -> None:
    """Upgrade schema."""
    # `btree_gist` est indispensable : un index GiST ne sait pas comparer deux
    # entiers pour l'egalite sans elle, et c'est exactement ce que fait
    # `id_salle WITH =`.
    #
    # `IF NOT EXISTS` : l'extension peut deja etre presente, installee par un
    # operateur ou par une autre application partageant la base.
    #
    # Elle est *trusted* depuis PostgreSQL 13 — verifie sur l'instance cible,
    # PostgreSQL 16.14, `trusted = True` — donc installable par un role
    # disposant du seul privilege CREATE sur la base, sans etre superutilisateur.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    # `tstzrange(date_debut, date_fin)` a des bornes `[)` : debut inclus, fin
    # exclue. Deux creneaux adjacents — l'un finissant quand l'autre commence —
    # ne se chevauchent donc pas, ce qui est le comportement attendu pour une
    # salle liberee a l'heure pile.
    #
    # ECRITES A LA MAIN : l'autogeneration d'Alembic ne compare pas les
    # contraintes d'exclusion, comme elle ne compare pas les CHECK.
    for nom, colonne in CONTRAINTES:
        op.execute(
            f"ALTER TABLE reservation ADD CONSTRAINT {nom}"
            f" EXCLUDE USING gist ({colonne} WITH =,"
            f" tstzrange(date_debut, date_fin) WITH &&)"
            f" WHERE ({colonne} IS NOT NULL AND {PREDICAT})"
        )


def downgrade() -> None:
    """Downgrade schema."""
    for nom, _ in CONTRAINTES:
        op.execute(f"ALTER TABLE reservation DROP CONSTRAINT IF EXISTS {nom}")

    # L'EXTENSION N'EST PAS RETIREE, et c'est un choix.
    #
    # `CREATE EXTENSION IF NOT EXISTS` ne dit pas si c'est cette migration qui
    # l'a creee : elle pouvait deja etre la. Un `DROP EXTENSION` au downgrade
    # supprimerait donc potentiellement un objet que nous n'avons pas installe.
    #
    # C'est un objet partage au niveau de la base, pas une structure de cette
    # table : d'autres index, d'autres applications sur la meme base peuvent en
    # dependre. `DROP EXTENSION` echouerait alors, faisant echouer un downgrade
    # qui n'a par ailleurs plus rien a defaire ; et un `DROP EXTENSION CASCADE`
    # detruirait ces dependances sans le dire.
    #
    # Laisser une extension inutilisee ne coute rien et ne casse rien. La
    # supprimer peut casser autre chose. L'asymetrie tranche.
