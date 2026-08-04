"""Tests du repository PERSONNEL."""

from collections.abc import Iterator

import pytest
from sqlalchemy.orm import Session

from app.models.personnel import FonctionPersonnel, Personnel
from app.repositories.personnel_repository import PersonnelRepository
from tests.conftest import creer_engine_sqlite


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(Personnel.__table__)
    with Session(engine) as session:
        yield session


@pytest.fixture
def depot(db: Session) -> PersonnelRepository:
    return PersonnelRepository(db)


def _creer(
    depot: PersonnelRepository,
    email: str,
    fonction: FonctionPersonnel = FonctionPersonnel.LIVREUR,
    **extra: object,
) -> Personnel:
    personnel = depot.create(
        {
            "nom": "Rakoto",
            "prenom": "Jean",
            "fonction": fonction,
            "email": email,
            **extra,
        }
    )
    depot.db.commit()
    return personnel


# --- get_by_email -------------------------------------------------------------


def test_get_by_email_trouve_une_ligne_active(depot: PersonnelRepository) -> None:
    _creer(depot, "jean@delta.mg")

    assert depot.get_by_email("jean@delta.mg") is not None


def test_get_by_email_ignore_une_ligne_archivee(depot: PersonnelRepository) -> None:
    personnel = _creer(depot, "jean@delta.mg")
    depot.delete(personnel)
    depot.db.commit()

    assert depot.get_by_email("jean@delta.mg") is None


def test_get_by_email_survit_a_plusieurs_archives_de_meme_adresse(
    depot: PersonnelRepository,
) -> None:
    """Le cas que l'index partiel rend possible : départs et retours successifs.

    Sans le filtre sur `supprime_le`, `one_or_none()` lèverait
    `MultipleResultsFound` dès la deuxième réembauche.
    """
    for _ in range(3):
        personnel = _creer(depot, "jean@delta.mg")
        depot.delete(personnel)
        depot.db.commit()
    actif = _creer(depot, "jean@delta.mg")

    trouve = depot.get_by_email("jean@delta.mg")

    assert trouve is not None
    assert trouve.id_personnel == actif.id_personnel


def test_get_by_email_inclure_supprimes_remonte_une_archive(
    depot: PersonnelRepository,
) -> None:
    personnel = _creer(depot, "jean@delta.mg")
    depot.delete(personnel)
    depot.db.commit()

    assert depot.get_by_email("jean@delta.mg", inclure_supprimes=True) is not None


# --- lister_par_fonction ------------------------------------------------------


def test_lister_par_fonction_filtre(depot: PersonnelRepository) -> None:
    _creer(depot, "livreur@delta.mg", FonctionPersonnel.LIVREUR)
    _creer(depot, "formateur@delta.mg", FonctionPersonnel.FORMATEUR)

    livreurs = depot.lister_par_fonction(FonctionPersonnel.LIVREUR)

    assert [p.email for p in livreurs] == ["livreur@delta.mg"]


def test_lister_par_fonction_masque_les_archives(depot: PersonnelRepository) -> None:
    """Un salarié archivé ne doit pas apparaître parmi les affectables.

    Le filtre n'est pas hérité de `list()` : cette requête est écrite à part.
    """
    parti = _creer(depot, "parti@delta.mg", FonctionPersonnel.LIVREUR)
    _creer(depot, "present@delta.mg", FonctionPersonnel.LIVREUR)
    depot.delete(parti)
    depot.db.commit()

    livreurs = depot.lister_par_fonction(FonctionPersonnel.LIVREUR)

    assert [p.email for p in livreurs] == ["present@delta.mg"]


def test_lister_par_fonction_sans_titulaire_donne_une_liste_vide(
    depot: PersonnelRepository,
) -> None:
    _creer(depot, "livreur@delta.mg", FonctionPersonnel.LIVREUR)

    assert depot.lister_par_fonction(FonctionPersonnel.CUISINIER) == []


def test_lister_par_fonction_est_ordonne_et_paginable(
    depot: PersonnelRepository,
) -> None:
    for n in range(5):
        _creer(depot, f"livreur{n}@delta.mg", FonctionPersonnel.LIVREUR)

    page = depot.lister_par_fonction(FonctionPersonnel.LIVREUR, skip=1, limit=2)

    assert [p.email for p in page] == ["livreur1@delta.mg", "livreur2@delta.mg"]


# --- CRUD hérité --------------------------------------------------------------


def test_le_crud_generique_n_est_pas_reecrit() -> None:
    """`BaseRepository` porte le CRUD ; le repository n'ajoute que le reste.

    Redéfinir `create` / `get_by_id` / `list` / `update` / `delete` ici serait le
    signe que l'héritage n'est pas utilisé (cf. `docs/architecture.md`).
    """
    redefinies = set(vars(PersonnelRepository)) & {
        "create",
        "get_by_id",
        "list",
        "update",
        "delete",
        "restaurer",
        "supprimer_definitivement",
    }

    assert redefinies == set()


def test_archivage_puis_restauration(depot: PersonnelRepository) -> None:
    personnel = _creer(depot, "jean@delta.mg")
    depot.delete(personnel)
    depot.db.commit()
    assert depot.get_by_id(personnel.id_personnel) is None

    depot.restaurer(personnel)
    depot.db.commit()

    assert depot.get_by_id(personnel.id_personnel) is not None


def test_est_administrateur_vaut_faux_par_defaut(depot: PersonnelRepository) -> None:
    """Le défaut d'un droit est de ne pas l'accorder."""
    personnel = _creer(depot, "jean@delta.mg")

    assert personnel.est_administrateur is False
