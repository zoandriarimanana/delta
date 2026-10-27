"""Tests du script d'amorçage du premier administrateur.

Le script est le **seul** chemin d'écriture de `est_administrateur`, aucun
endpoint ne l'expose. Ce qui est vérifié ici tient donc lieu de garantie pour la
seule porte qui reste ouverte.
"""

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import Session

from app.core.security import verifier_mot_de_passe
from app.models.personnel import FonctionPersonnel, Personnel
from scripts.creer_admin import (
    LONGUEUR_MIN_MOT_DE_PASSE,
    VARIABLE_MOT_DE_PASSE,
    AmorcageImpossible,
    creer_administrateur,
    lire_mot_de_passe,
)
from tests.conftest import creer_engine_sqlite

MOT_DE_PASSE = "MotDePasseAdmin2026"


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(Personnel.__table__)
    with Session(engine) as session:
        yield session


def _creer(db: Session, email: str = "chef@delta.mg", **extra: object) -> Personnel:
    parametres: dict = {
        "email": email,
        "nom": "Rakoto",
        "prenom": "Jean",
        "fonction": FonctionPersonnel.AUTRE,
        "mot_de_passe": MOT_DE_PASSE,
    }
    parametres.update(extra)
    return creer_administrateur(db, **parametres)


# --- Création -----------------------------------------------------------------


def test_cree_bien_un_administrateur(db: Session) -> None:
    personnel = _creer(db)

    assert personnel.est_administrateur is True


def test_le_mot_de_passe_est_hache_et_non_stocke_en_clair(db: Session) -> None:
    personnel = _creer(db)

    assert personnel.mot_de_passe is not None
    assert personnel.mot_de_passe != MOT_DE_PASSE
    assert verifier_mot_de_passe(MOT_DE_PASSE, personnel.mot_de_passe)


def test_la_fonction_reste_libre_et_orthogonale(db: Session) -> None:
    """Administrer n'est pas un métier : n'importe quelle fonction peut cumuler."""
    personnel = _creer(db, fonction=FonctionPersonnel.FORMATEUR)

    assert personnel.fonction is FonctionPersonnel.FORMATEUR
    assert personnel.est_administrateur is True


def test_adresse_deja_prise_refusee(db: Session) -> None:
    _creer(db)

    with pytest.raises(AmorcageImpossible):
        _creer(db)


def test_adresse_d_un_archive_reste_utilisable(db: Session) -> None:
    """L'index `uq_personnel_email` est partiel : un homonyme archivé ne bloque
    pas."""
    premier = _creer(db)
    premier.supprime_le = datetime.now(UTC)
    db.commit()

    assert _creer(db).id_personnel != premier.id_personnel


# --- Validation du mot de passe -----------------------------------------------


def test_mot_de_passe_trop_court_refuse(db: Session) -> None:
    with pytest.raises(AmorcageImpossible):
        _creer(db, mot_de_passe="a" * (LONGUEUR_MIN_MOT_DE_PASSE - 1))


def test_mot_de_passe_au_dela_de_72_octets_refuse(db: Session) -> None:
    """bcrypt tronque silencieusement au-delà : accepter donnerait l'illusion
    d'un secret plus fort que celui réellement vérifié."""
    with pytest.raises(AmorcageImpossible):
        _creer(db, mot_de_passe="a" * 73)


def test_la_borne_compte_les_octets_et_non_les_caracteres(db: Session) -> None:
    """« é » fait deux octets en UTF-8 : 40 caractères en font 80."""
    with pytest.raises(AmorcageImpossible):
        _creer(db, mot_de_passe="é" * 40)


def test_rien_n_est_ecrit_quand_le_mot_de_passe_est_refuse(db: Session) -> None:
    """La validation précède l'insertion : pas de ligne orpheline sans secret."""
    with pytest.raises(AmorcageImpossible):
        _creer(db, mot_de_passe="court")

    assert db.query(Personnel).count() == 0


# --- Lecture du mot de passe --------------------------------------------------


def test_lit_le_mot_de_passe_depuis_l_environnement(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(VARIABLE_MOT_DE_PASSE, MOT_DE_PASSE)

    assert lire_mot_de_passe() == MOT_DE_PASSE


def test_refuse_sans_terminal_ni_variable(monkeypatch: pytest.MonkeyPatch) -> None:
    """Cas d'un conteneur ou d'une CI : mieux vaut échouer que bloquer sur une
    saisie que personne ne verra."""
    monkeypatch.delenv(VARIABLE_MOT_DE_PASSE, raising=False)
    monkeypatch.setattr("sys.stdin.isatty", lambda: False)

    with pytest.raises(AmorcageImpossible):
        lire_mot_de_passe()


def test_saisie_interactive_confirmee(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(VARIABLE_MOT_DE_PASSE, raising=False)
    monkeypatch.setattr("sys.stdin.isatty", lambda: True)
    monkeypatch.setattr("getpass.getpass", lambda _: MOT_DE_PASSE)

    assert lire_mot_de_passe() == MOT_DE_PASSE


def test_saisies_divergentes_refusees(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(VARIABLE_MOT_DE_PASSE, raising=False)
    monkeypatch.setattr("sys.stdin.isatty", lambda: True)
    saisies = iter([MOT_DE_PASSE, "AutreMotDePasse2026"])
    monkeypatch.setattr("getpass.getpass", lambda _: next(saisies))

    with pytest.raises(AmorcageImpossible):
        lire_mot_de_passe()


def test_le_mot_de_passe_n_est_jamais_un_argument() -> None:
    """Verrou de conception : en argument, il resterait dans l'historique du
    shell et serait visible dans `ps`.

    Ce test tombe si quelqu'un ajoute l'option par commodité.
    """
    from scripts.creer_admin import _analyser

    with pytest.raises(SystemExit):
        _analyser(
            [
                "--email",
                "chef@delta.mg",
                "--nom",
                "Rakoto",
                "--prenom",
                "Jean",
                "--fonction",
                "Autre",
                "--mot-de-passe",
                MOT_DE_PASSE,
            ]
        )
