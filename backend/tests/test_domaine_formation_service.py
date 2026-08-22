"""Tests du service DOMAINE_FORMATION."""

from collections.abc import Iterator

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, RessourceIntrouvable
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.session_formation import SessionFormation
from app.schemas.domaine_formation import (
    DomaineFormationCreate,
    DomaineFormationUpdate,
)
from app.schemas.formation import FormationCreate
from app.services.domaine_formation_service import (
    CONTRAINTE_LIBELLE_UNIQUE,
    DomaineFormationService,
)
from app.services.formation_service import FormationService
from tests.conftest import creer_engine_sqlite, erreur_integrite_postgres


@pytest.fixture
def db() -> Iterator[Session]:
    # `session_formation` est nécessaire depuis #35 : `FormationService`
    # compte les sessions actives avant d'archiver une formation.
    engine = creer_engine_sqlite(
        DomaineFormation.__table__, Formation.__table__, SessionFormation.__table__
    )
    with Session(engine) as session:
        yield session


@pytest.fixture
def service(db: Session) -> DomaineFormationService:
    return DomaineFormationService(db)


@pytest.fixture
def formations(db: Session) -> FormationService:
    return FormationService(db)


def _donnees(libelle: str = "Pâtisserie") -> DomaineFormationCreate:
    return DomaineFormationCreate(libelle=libelle, description="Gâteaux et entremets")


def _formation(id_domaine: int, titre: str = "CAP Pâtissier") -> FormationCreate:
    return FormationCreate(
        titre=titre,
        duree_heures=140,
        prix="850000.00",
        capacite_max=12,
        id_domaine=id_domaine,
    )


# --- Création -----------------------------------------------------------------


def test_creation(service: DomaineFormationService) -> None:
    domaine = service.creer(_donnees())

    assert domaine.id_domaine is not None
    assert domaine.description == "Gâteaux et entremets"


def test_libelle_deja_pris_leve_un_conflit(service: DomaineFormationService) -> None:
    service.creer(_donnees())

    with pytest.raises(ConflitMetier):
        service.creer(_donnees())


def test_libelle_libere_par_archivage_est_reutilisable(
    service: DomaineFormationService,
) -> None:
    """L'index est partiel : un domaine archivé ne bloque pas son propre libellé."""
    premier = service.creer(_donnees())
    service.supprimer(premier.id_domaine)

    second = service.creer(_donnees())

    assert second.id_domaine != premier.id_domaine


def test_conflit_traduit_depuis_l_integrity_error(
    service: DomaineFormationService, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La course que le pré-contrôle ne couvre pas.

    Entre la vérification et le `commit`, une autre transaction a pu prendre le
    libellé. La branche est exercée avec une erreur nommée comme PostgreSQL la
    remonte — SQLite ne fournit pas `diag.constraint_name`.
    """

    def echouer(*_: object, **__: object) -> None:
        raise erreur_integrite_postgres(CONTRAINTE_LIBELLE_UNIQUE)

    monkeypatch.setattr(service.db, "commit", echouer)

    with pytest.raises(ConflitMetier):
        service.creer(_donnees())


def test_autre_violation_n_est_pas_traduite_en_conflit(
    service: DomaineFormationService, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Une contrainte inconnue doit remonter telle quelle, pas en 409 trompeur."""

    def echouer(*_: object, **__: object) -> None:
        raise erreur_integrite_postgres("ck_une_autre_contrainte")

    monkeypatch.setattr(service.db, "commit", echouer)

    with pytest.raises(IntegrityError):
        service.creer(_donnees())


# --- Lecture et modification --------------------------------------------------


def test_obtenir_inconnu_leve_introuvable(service: DomaineFormationService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(99999)


def test_obtenir_archive_leve_introuvable(service: DomaineFormationService) -> None:
    """Un archivé est invisible, exactement comme s'il n'avait jamais existé."""
    domaine = service.creer(_donnees())
    service.supprimer(domaine.id_domaine)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir(domaine.id_domaine)


def test_modification_partielle_ne_touche_que_les_champs_fournis(
    service: DomaineFormationService,
) -> None:
    domaine = service.creer(_donnees())

    service.modifier(domaine.id_domaine, DomaineFormationUpdate(libelle="Boulangerie"))

    assert domaine.libelle == "Boulangerie"
    assert domaine.description == "Gâteaux et entremets"


def test_modification_vers_un_libelle_pris_leve_un_conflit(
    service: DomaineFormationService,
) -> None:
    service.creer(_donnees("Pâtisserie"))
    autre = service.creer(_donnees("Cuisine"))

    with pytest.raises(ConflitMetier):
        service.modifier(autre.id_domaine, DomaineFormationUpdate(libelle="Pâtisserie"))


# --- Archivage ----------------------------------------------------------------


def test_archivage_refuse_si_des_formations_actives(
    service: DomaineFormationService, formations: FormationService
) -> None:
    domaine = service.creer(_donnees())
    formations.creer(_formation(domaine.id_domaine))

    with pytest.raises(ConflitMetier):
        service.supprimer(domaine.id_domaine)


def test_archivage_permis_si_les_formations_sont_archivees(
    service: DomaineFormationService, formations: FormationService
) -> None:
    """Le comptage **filtre** les archivées.

    Sans ce filtre, un domaine dont toutes les formations sont archivées
    deviendrait inarchivable à jamais — et rien dans les données ne dirait
    pourquoi.
    """
    domaine = service.creer(_donnees())
    formation = formations.creer(_formation(domaine.id_domaine))
    formations.supprimer(formation.id_formation)

    service.supprimer(domaine.id_domaine)

    assert domaine.supprime_le is not None


# --- Restauration -------------------------------------------------------------


def test_restauration(service: DomaineFormationService) -> None:
    domaine = service.creer(_donnees())
    service.supprimer(domaine.id_domaine)

    service.restaurer(domaine.id_domaine)

    assert service.obtenir(domaine.id_domaine) is not None


def test_restauration_idempotente(service: DomaineFormationService) -> None:
    """Rejouer une restauration n'est pas une erreur métier."""
    domaine = service.creer(_donnees())

    assert service.restaurer(domaine.id_domaine).id_domaine == domaine.id_domaine


def test_restauration_refusee_si_le_libelle_a_ete_repris(
    service: DomaineFormationService,
) -> None:
    """L'index étant partiel, le libellé a pu être réattribué entre-temps."""
    premier = service.creer(_donnees())
    service.supprimer(premier.id_domaine)
    service.creer(_donnees())

    with pytest.raises(ConflitMetier):
        service.restaurer(premier.id_domaine)
