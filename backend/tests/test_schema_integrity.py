"""Garde-fou CI sur la structure du schéma relationnel.

Ces tests ne valident aucune logique métier : ils figent la structure attendue
de `Base.metadata` pour que toute régression sur le schéma (table supprimée du
package `models`, contrainte perdue lors d'un refactor, oubli d'import dans
`app/models/__init__.py`) fasse échouer la CI au lieu de dépendre d'une
relecture manuelle.

Ils ne nécessitent aucune base de données : tout est inspecté sur les métadonnées
SQLAlchemy en mémoire.

Toute évolution volontaire du schéma doit se répercuter ici, dans `docs/mld.md`
et dans une migration Alembic — jamais l'un sans les autres.
"""

import pytest
from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlalchemy.orm import configure_mappers

import app.models  # noqa: F401  (peuple Base.metadata avec les 20 entités)
from app.core.database import Base

# Les 20 tables du MLD (`docs/mld.md`).
TABLES_ATTENDUES = frozenset(
    {
        "abonnement",
        "avis",
        "beneficiaire",
        "categorie_produit",
        "client",
        "client_entreprise",
        "client_particulier",
        "commande",
        "consommation_repas",
        "demande_personnalisation",
        "domaine_formation",
        "formation",
        "ligne_commande",
        "livraison",
        "logement",
        "personnel",
        "produit",
        "reservation",
        "salle",
        "session_formation",
    }
)

# Contraintes d'intégrité exigées par `docs/mld.md` et non déductibles des FK.
CHECKS_ATTENDUS = [
    ("reservation", "ck_reservation_cible_unique"),
    ("avis", "ck_avis_cible_xor"),
    ("avis", "ck_avis_note_intervalle"),
]

# Cardinalités (1,1) du schéma conceptuel, traduites en UNIQUE.
UNIQUES_ATTENDUS = [
    ("livraison", "uq_livraison_id_commande", {"id_commande"}),
    (
        "demande_personnalisation",
        "uq_demande_personnalisation_id_ligne",
        {"id_ligne"},
    ),
]

# FK NOT NULL protégées en RESTRICT : PostgreSQL refuse la suppression du parent
# plutôt que de tenter un SET NULL sur une colonne qui l'interdit.
FK_RESTRICT_ATTENDUES = [
    ("abonnement", "id_client_entreprise"),
    ("avis", "id_client"),
    ("beneficiaire", "id_abonnement"),
    ("consommation_repas", "id_abonnement"),
    ("demande_personnalisation", "id_produit_base"),
    ("formation", "id_domaine"),
    ("ligne_commande", "id_produit"),
    ("livraison", "id_commande"),
    ("produit", "id_categorie"),
    ("reservation", "id_client"),
    ("session_formation", "id_formation"),
]

# FK NOT NULL en CASCADE assumée : la ligne fille n'a pas d'existence propre
# sans son parent (sous-types de CLIENT, lignes d'une commande, demande de
# personnalisation d'une ligne).
FK_CASCADE_ATTENDUES = [
    ("client_entreprise", "id_client"),
    ("client_particulier", "id_client"),
    ("demande_personnalisation", "id_ligne"),
    ("ligne_commande", "id_commande"),
]


def test_mappers_configurables() -> None:
    """Toutes les relations se résolvent : aucune cible orpheline ni ambiguë."""
    configure_mappers()


def test_nombre_de_tables() -> None:
    """Les 20 tables du MLD sont bien enregistrées dans `Base.metadata`."""
    assert len(Base.metadata.tables) == 20


def test_liste_des_tables() -> None:
    """Aucune table n'a été renommée, ajoutée ou retirée sans mise à jour du MLD."""
    assert set(Base.metadata.tables) == TABLES_ATTENDUES


@pytest.mark.parametrize(("table", "contrainte"), CHECKS_ATTENDUS)
def test_check_constraint_presente(table: str, contrainte: str) -> None:
    """Chaque CHECK exigé par le MLD est bien porté par sa table."""
    presentes = {
        c.name
        for c in Base.metadata.tables[table].constraints
        if isinstance(c, CheckConstraint)
    }
    assert (
        contrainte in presentes
    ), f"CHECK `{contrainte}` absent de `{table}` (présents : {sorted(presentes)})"


@pytest.mark.parametrize(("table", "contrainte", "colonnes"), UNIQUES_ATTENDUS)
def test_unique_constraint_presente(
    table: str, contrainte: str, colonnes: set[str]
) -> None:
    """Chaque cardinalité (1,1) est bien verrouillée par un UNIQUE, sur la bonne
    colonne."""
    trouvee = next(
        (
            c
            for c in Base.metadata.tables[table].constraints
            if isinstance(c, UniqueConstraint) and c.name == contrainte
        ),
        None,
    )
    assert trouvee is not None, f"UNIQUE `{contrainte}` absent de `{table}`"
    assert {col.name for col in trouvee.columns} == colonnes


def _ondelete(table: str, colonne: str) -> str | None:
    """Retourne la clause ON DELETE de la FK portée par `table.colonne`."""
    cible = Base.metadata.tables[table].columns[colonne]
    fk = next(iter(cible.foreign_keys))
    return fk.ondelete


@pytest.mark.parametrize(("table", "colonne"), FK_RESTRICT_ATTENDUES)
def test_fk_not_null_en_restrict(table: str, colonne: str) -> None:
    """La suppression du parent est refusée par PostgreSQL, pas subie.

    Sans `ondelete`, SQLAlchemy tente un SET NULL sur une colonne NOT NULL :
    l'erreur remonte alors en `IntegrityError` opaque au lieu d'une violation
    de contrainte explicite et catchable côté service.
    """
    assert not Base.metadata.tables[table].columns[colonne].nullable
    assert _ondelete(table, colonne) == "RESTRICT"


@pytest.mark.parametrize(("table", "colonne"), FK_CASCADE_ATTENDUES)
def test_fk_not_null_en_cascade_assumee(table: str, colonne: str) -> None:
    """Les seules FK NOT NULL en CASCADE sont celles listées ici, volontairement."""
    assert _ondelete(table, colonne) == "CASCADE"


def test_aucune_fk_not_null_sans_ondelete() -> None:
    """Filet pour les entités futures : toute FK NOT NULL doit trancher.

    Ce test échoue dès qu'un modèle ajouté plus tard porte une FK NOT NULL sans
    politique de suppression explicite — le cas où le comportement par défaut
    (SET NULL) est justement impossible à honorer.
    """
    sans_politique = sorted(
        f"{table.name}.{fk.parent.name}"
        for table in Base.metadata.tables.values()
        for fk in table.foreign_keys
        if not fk.parent.nullable and fk.ondelete is None
    )
    assert sans_politique == [], (
        "FK NOT NULL sans ON DELETE explicite : "
        f"{sans_politique} — choisir RESTRICT ou CASCADE et l'ajouter aux "
        "listes de ce fichier."
    )
