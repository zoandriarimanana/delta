"""couplage reservation formation et logement

Revision ID: 90500366dbfd
Revises: acadf9ddce27
Create Date: 2026-08-27 14:09:24.513390

Ajoute `RESERVATION.id_reservation_hebergement`, l'auto-reference qui lie une
reservation de formation a la reservation de logement qui l'accompagne.

Le couplage passe par **deux lignes** et jamais par une seule : le `CHECK`
d'exclusivite (contrainte n°2 du MLD) interdit qu'une meme ligne porte a la fois
`id_session` et `id_logement`. C'est cette migration qui introduit la colonne du
lien -- le MLD n'en portait aucune.

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "90500366dbfd"
down_revision: str | Sequence[str] | None = "acadf9ddce27"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "reservation",
        sa.Column("id_reservation_hebergement", sa.Integer(), nullable=True),
    )

    # UNIQUE **globale** et non partielle. Elle exprime une propriete
    # structurelle -- une reservation d'hebergement appartient a au plus une
    # formation -- et non une identite metier libere par l'archivage. Rendue
    # partielle, la table pourrait porter cinq liens archives et un actif vers
    # la meme chambre, et tout comptage omettant le filtre serait faux. Meme
    # traitement que `LIVRAISON.id_commande` (cf. `docs/mld.md`).
    op.create_unique_constraint(
        op.f("uq_reservation_id_reservation_hebergement"),
        "reservation",
        ["id_reservation_hebergement"],
    )

    # ON DELETE RESTRICT et non CASCADE : une reservation d'hebergement est une
    # preuve de transaction au meme titre que celle de formation. Le chemin
    # normal est l'archivage, qui est un UPDATE et ne declenche de toute facon
    # aucune de ces politiques -- la propagation revient au service.
    op.create_foreign_key(
        op.f("fk_reservation_id_reservation_hebergement_reservation"),
        "reservation",
        "reservation",
        ["id_reservation_hebergement"],
        ["id_reservation"],
        ondelete="RESTRICT",
    )

    # ECRITES A LA MAIN : l'autogeneration ne compare pas les contraintes CHECK,
    # et le comparateur d'Alembic 1.19 est desactive dans `env.py` (faux
    # positifs sur les `sa.Enum`). Meme traitement que `au_moins_un_tarif`.
    #
    # Seule une reservation de formation porte un hebergement lie. Sans ce
    # CHECK, une reservation de salle pourrait en porter un, et le lien
    # n'aurait aucun sens que quiconque puisse interpreter.
    op.create_check_constraint(
        "hebergement_lie_a_une_formation",
        "reservation",
        "id_reservation_hebergement IS NULL OR type_reservation = 'Formation'",
    )

    # Une ligne ne se lie pas a elle-meme. Le cas n'a aucun sens metier et
    # produirait une boucle que toute propagation d'annulation suivrait
    # indefiniment. Le refuser en base coute une comparaison ; le detecter en
    # service supposerait de s'en souvenir a chaque nouvel appelant.
    op.create_check_constraint(
        "hebergement_distinct_de_la_formation",
        "reservation",
        "id_reservation_hebergement IS NULL"
        " OR id_reservation_hebergement <> id_reservation",
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Les noms des CHECK sont passes **nus**, sans prefixe : la convention de
    # nommage de `core/database.py` les complete en `ck_reservation_...`.
    # Passer le nom complet produirait `ck_reservation_ck_reservation_...` et un
    # echec -- bug attrape par l'aller-retour lors de la migration 22127cdc2dce.
    op.drop_constraint(
        "hebergement_distinct_de_la_formation", "reservation", type_="check"
    )
    op.drop_constraint("hebergement_lie_a_une_formation", "reservation", type_="check")
    op.drop_constraint(
        op.f("fk_reservation_id_reservation_hebergement_reservation"),
        "reservation",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("uq_reservation_id_reservation_hebergement"),
        "reservation",
        type_="unique",
    )
    op.drop_column("reservation", "id_reservation_hebergement")
