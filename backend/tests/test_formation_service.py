"""Tests du service FORMATION."""

from collections.abc import Iterator
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ReferenceInvalide, RessourceIntrouvable
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.session_formation import SessionFormation
from app.schemas.domaine_formation import DomaineFormationCreate
from app.schemas.formation import FormationCreate, FormationUpdate
from app.services.domaine_formation_service import DomaineFormationService
from app.services.formation_service import (
    CONTRAINTE_FORMATION_DOMAINE,
    FormationService,
)
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
def service(db: Session) -> FormationService:
    return FormationService(db)


@pytest.fixture
def domaine(db: Session) -> DomaineFormation:
    return DomaineFormationService(db).creer(
        DomaineFormationCreate(libelle="Pâtisserie")
    )


def _donnees(id_domaine: int, titre: str = "CAP Pâtissier", **extra: object):
    parametres: dict = {
        "titre": titre,
        "duree_heures": 140,
        "prix": "850000.00",
        "capacite_max": 12,
        "id_domaine": id_domaine,
    }
    parametres.update(extra)
    return FormationCreate(**parametres)


# --- Création -----------------------------------------------------------------


def test_creation(service: FormationService, domaine: DomaineFormation) -> None:
    formation = service.creer(_donnees(domaine.id_domaine))

    assert formation.id_formation is not None
    assert formation.prix == Decimal("850000.00")
    assert formation.propose_hebergement is False


def test_domaine_inexistant_leve_reference_invalide(service: FormationService) -> None:
    """422 : la référence est dans le corps, pas dans l'URL."""
    with pytest.raises(ReferenceInvalide):
        service.creer(_donnees(99999))


def test_domaine_archive_traite_comme_inexistant(
    db: Session, service: FormationService, domaine: DomaineFormation
) -> None:
    DomaineFormationService(db).supprimer(domaine.id_domaine)

    with pytest.raises(ReferenceInvalide):
        service.creer(_donnees(domaine.id_domaine))


def test_reference_invalide_traduite_depuis_l_integrity_error(
    service: FormationService,
    domaine: DomaineFormation,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La course : le domaine disparaît entre la vérification et le `commit`."""

    def echouer(*_: object, **__: object) -> None:
        raise erreur_integrite_postgres(CONTRAINTE_FORMATION_DOMAINE)

    monkeypatch.setattr(service.db, "commit", echouer)

    with pytest.raises(ReferenceInvalide):
        service.creer(_donnees(domaine.id_domaine))


def test_autre_violation_n_est_pas_traduite(
    service: FormationService,
    domaine: DomaineFormation,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def echouer(*_: object, **__: object) -> None:
        raise erreur_integrite_postgres("ck_une_autre_contrainte")

    monkeypatch.setattr(service.db, "commit", echouer)

    with pytest.raises(IntegrityError):
        service.creer(_donnees(domaine.id_domaine))


# --- Validation des bornes ----------------------------------------------------


def test_duree_nulle_ou_negative_refusee(domaine: DomaineFormation) -> None:
    """Une formation de zéro heure n'est pas une formation."""
    for duree in (0, -3):
        with pytest.raises(ValueError):
            _donnees(domaine.id_domaine, duree_heures=duree)


def test_capacite_nulle_refusee(domaine: DomaineFormation) -> None:
    """Une capacité nulle rendrait toute session complète dès sa création."""
    with pytest.raises(ValueError):
        _donnees(domaine.id_domaine, capacite_max=0)


def test_prix_negatif_refuse(domaine: DomaineFormation) -> None:
    with pytest.raises(ValueError):
        _donnees(domaine.id_domaine, prix="-1.00")


def test_prix_nul_accepte(service: FormationService, domaine: DomaineFormation) -> None:
    """Une formation offerte reste un cas légitime, comme un produit offert."""
    formation = service.creer(_donnees(domaine.id_domaine, prix="0.00"))

    assert formation.prix == Decimal("0.00")


def test_niveau_reste_une_chaine_libre(
    service: FormationService, domaine: DomaineFormation
) -> None:
    """Aucune règle de service ne compare `niveau` : il n'est pas contraint.

    Le contraindre imposerait une migration à chaque nouvelle offre
    commerciale — voir la question ouverte de l'issue.
    """
    formation = service.creer(_donnees(domaine.id_domaine, niveau="Perfectionnement"))

    assert formation.niveau == "Perfectionnement"


# --- Lecture ------------------------------------------------------------------


def test_obtenir_inconnue_leve_introuvable(service: FormationService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(99999)


def test_lister_filtre_par_domaine(
    db: Session, service: FormationService, domaine: DomaineFormation
) -> None:
    autre = DomaineFormationService(db).creer(DomaineFormationCreate(libelle="Cuisine"))
    service.creer(_donnees(domaine.id_domaine, "CAP Pâtissier"))
    service.creer(_donnees(autre.id_domaine, "CAP Cuisine"))

    assert [f.titre for f in service.lister(domaine.id_domaine)] == ["CAP Pâtissier"]


def test_lister_sans_filtre_retourne_tout(
    service: FormationService, domaine: DomaineFormation
) -> None:
    service.creer(_donnees(domaine.id_domaine, "CAP Pâtissier"))
    service.creer(_donnees(domaine.id_domaine, "CAP Chocolatier"))

    assert len(service.lister()) == 2


def test_filtre_sur_un_domaine_inconnu_donne_une_liste_vide(
    service: FormationService,
) -> None:
    """Critère de recherche, pas ressource désignée : liste vide, pas 404."""
    assert service.lister(99999) == []


def test_le_filtre_masque_les_formations_archivees(
    service: FormationService, domaine: DomaineFormation
) -> None:
    """Le filtre par domaine ne passe pas par `list()` : il refait le filtrage.

    Sans lui, le catalogue filtré montrerait des formations que le catalogue
    complet masque.
    """
    formation = service.creer(_donnees(domaine.id_domaine))
    service.supprimer(formation.id_formation)

    assert service.lister(domaine.id_domaine) == []


# --- Modification -------------------------------------------------------------


def test_modification_partielle(
    service: FormationService, domaine: DomaineFormation
) -> None:
    formation = service.creer(_donnees(domaine.id_domaine, niveau="Débutant"))

    service.modifier(formation.id_formation, FormationUpdate(prix="900000.00"))

    assert formation.prix == Decimal("900000.00")
    assert formation.niveau == "Débutant"


def test_modification_revalide_le_domaine(
    service: FormationService, domaine: DomaineFormation
) -> None:
    formation = service.creer(_donnees(domaine.id_domaine))

    with pytest.raises(ReferenceInvalide):
        service.modifier(formation.id_formation, FormationUpdate(id_domaine=99999))


def test_modifier_inconnue_leve_introuvable(service: FormationService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.modifier(99999, FormationUpdate(titre="X"))


# --- Archivage ----------------------------------------------------------------


def test_archivage_rend_invisible(
    service: FormationService, domaine: DomaineFormation
) -> None:
    formation = service.creer(_donnees(domaine.id_domaine))

    service.supprimer(formation.id_formation)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir(formation.id_formation)
