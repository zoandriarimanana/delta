"""Tests du service SESSION_FORMATION."""

from collections.abc import Iterator
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.personnel import FonctionPersonnel, Personnel
from app.models.session_formation import SessionFormation, StatutSessionFormation
from app.schemas.domaine_formation import DomaineFormationCreate
from app.schemas.formation import FormationCreate
from app.schemas.session_formation import (
    SessionFormationCreate,
    SessionFormationUpdate,
)
from app.services.domaine_formation_service import DomaineFormationService
from app.services.formation_service import FormationService
from app.services.session_formation_service import SessionFormationService
from tests.conftest import creer_engine_sqlite

DEBUT = date(2026, 9, 1)
FIN = date(2026, 9, 5)


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(
        Personnel.__table__,
        DomaineFormation.__table__,
        Formation.__table__,
        SessionFormation.__table__,
    )
    with Session(engine) as session:
        yield session


@pytest.fixture
def service(db: Session) -> SessionFormationService:
    return SessionFormationService(db)


@pytest.fixture
def formations(db: Session) -> FormationService:
    return FormationService(db)


@pytest.fixture
def formation(db: Session, formations: FormationService) -> Formation:
    domaine = DomaineFormationService(db).creer(
        DomaineFormationCreate(libelle="Pâtisserie")
    )
    return formations.creer(
        FormationCreate(
            titre="CAP Pâtissier",
            duree_heures=140,
            prix="850000.00",
            capacite_max=12,
            id_domaine=domaine.id_domaine,
        )
    )


def _salarie(db: Session, fonction: FonctionPersonnel) -> Personnel:
    personnel = Personnel(
        nom="Rakoto",
        prenom="Jean",
        fonction=fonction,
        email=f"{fonction.value.lower()}_{uuid4().hex[:8]}@delta.mg",
        specialite="Entremets",
    )
    db.add(personnel)
    db.commit()
    return personnel


@pytest.fixture
def formateur(db: Session) -> Personnel:
    return _salarie(db, FonctionPersonnel.FORMATEUR)


def _donnees(id_formation: int, **extra: object) -> SessionFormationCreate:
    parametres: dict = {
        "date_debut": DEBUT,
        "date_fin": FIN,
        "id_formation": id_formation,
    }
    parametres.update(extra)
    return SessionFormationCreate(**parametres)


# --- Création -----------------------------------------------------------------


def test_creation(service: SessionFormationService, formation: Formation) -> None:
    session = service.creer(_donnees(formation.id_formation))

    assert session.id_session is not None
    assert session.statut is StatutSessionFormation.PLANIFIEE


def test_places_initialisees_depuis_la_capacite(
    service: SessionFormationService, formation: Formation
) -> None:
    """Posées par le serveur, jamais reçues de la requête."""
    session = service.creer(_donnees(formation.id_formation))

    assert session.places_restantes == formation.capacite_max == 12


def test_places_ne_peuvent_pas_venir_de_la_requete() -> None:
    """Sinon on ouvrirait mille places sur une formation qui en compte douze."""
    charge = SessionFormationCreate.model_validate(
        {
            "date_debut": DEBUT.isoformat(),
            "date_fin": FIN.isoformat(),
            "id_formation": 1,
            "places_restantes": 1000,
            "statut": "Ouverte",
        }
    )

    assert not hasattr(charge, "places_restantes")
    assert not hasattr(charge, "statut")


def test_formation_inexistante_leve_reference_invalide(
    service: SessionFormationService,
) -> None:
    """422 : la référence est dans le corps, pas dans l'URL."""
    with pytest.raises(ReferenceInvalide):
        service.creer(_donnees(99999))


def test_formation_archivee_traitee_comme_inexistante(
    service: SessionFormationService, formations: FormationService, formation: Formation
) -> None:
    formations.supprimer(formation.id_formation)

    with pytest.raises(ReferenceInvalide):
        service.creer(_donnees(formation.id_formation))


def test_date_fin_anterieure_refusee(formation: Formation) -> None:
    with pytest.raises(ValueError):
        _donnees(formation.id_formation, date_fin=date(2026, 8, 1))


def test_session_d_une_journee_acceptee(
    service: SessionFormationService, formation: Formation
) -> None:
    """L'égalité est permise : une session d'une journée."""
    session = service.creer(_donnees(formation.id_formation, date_fin=DEBUT))

    assert session.date_debut == session.date_fin


def test_formateur_facultatif_a_la_creation(
    service: SessionFormationService, formation: Formation
) -> None:
    """Une session se planifie souvent avant qu'un formateur soit désigné."""
    session = service.creer(_donnees(formation.id_formation))

    assert session.id_formateur is None


def test_formateur_fourni_a_la_creation_est_verifie(
    service: SessionFormationService, formation: Formation, db: Session
) -> None:
    """La cohérence de fonction s'applique aussi à la création."""
    livreur = _salarie(db, FonctionPersonnel.LIVREUR)

    with pytest.raises(ReferenceInvalide):
        service.creer(
            _donnees(formation.id_formation, id_formateur=livreur.id_personnel)
        )


# --- Cohérence de fonction ----------------------------------------------------


def test_affectation_d_un_formateur(
    service: SessionFormationService, formation: Formation, formateur: Personnel
) -> None:
    session = service.creer(_donnees(formation.id_formation))

    affectee = service.affecter_formateur(session.id_session, formateur.id_personnel)

    assert affectee.id_formateur == formateur.id_personnel


@pytest.mark.parametrize(
    "fonction",
    [
        FonctionPersonnel.LIVREUR,
        FonctionPersonnel.CUISINIER,
        FonctionPersonnel.RECEPTIONNISTE,
        FonctionPersonnel.AUTRE,
    ],
)
def test_affectation_refuse_une_mauvaise_fonction(
    service: SessionFormationService,
    formation: Formation,
    db: Session,
    fonction: FonctionPersonnel,
) -> None:
    """Le cœur de l'issue, symétrique de celui de #25.

    `SESSION_FORMATION.#id_formateur` pointe vers `PERSONNEL` tout entier : rien
    en base n'empêche d'affecter un livreur. C'est le mécanisme partagé qui
    refuse.
    """
    session = service.creer(_donnees(formation.id_formation))
    intrus = _salarie(db, fonction)

    with pytest.raises(ReferenceInvalide) as capture:
        service.affecter_formateur(session.id_session, intrus.id_personnel)

    assert fonction.value in str(capture.value)


def test_affectation_refuse_un_salarie_archive(
    service: SessionFormationService,
    formation: Formation,
    formateur: Personnel,
    db: Session,
) -> None:
    from datetime import UTC, datetime

    session = service.creer(_donnees(formation.id_formation))
    formateur.supprime_le = datetime.now(UTC)
    db.commit()

    with pytest.raises(ReferenceInvalide):
        service.affecter_formateur(session.id_session, formateur.id_personnel)


def test_reaffectation_permise_tant_que_non_terminee(
    service: SessionFormationService, formation: Formation, db: Session
) -> None:
    """Un formateur peut se désister."""
    session = service.creer(_donnees(formation.id_formation))
    premier = _salarie(db, FonctionPersonnel.FORMATEUR)
    second = _salarie(db, FonctionPersonnel.FORMATEUR)
    service.affecter_formateur(session.id_session, premier.id_personnel)

    affectee = service.affecter_formateur(session.id_session, second.id_personnel)

    assert affectee.id_formateur == second.id_personnel


# --- Statut -------------------------------------------------------------------


def test_ouvrir_exige_un_formateur(
    service: SessionFormationService, formation: Formation
) -> None:
    """On n'ouvre pas les inscriptions sur une session que personne n'anime."""
    session = service.creer(_donnees(formation.id_formation))

    with pytest.raises(ConflitMetier):
        service.changer_statut(session.id_session, StatutSessionFormation.OUVERTE)


def test_ouverture_apres_affectation(
    service: SessionFormationService, formation: Formation, formateur: Personnel
) -> None:
    session = service.creer(_donnees(formation.id_formation))
    service.affecter_formateur(session.id_session, formateur.id_personnel)

    ouverte = service.changer_statut(session.id_session, StatutSessionFormation.OUVERTE)

    assert ouverte.statut is StatutSessionFormation.OUVERTE


@pytest.mark.parametrize(
    "terminal", [StatutSessionFormation.TERMINEE, StatutSessionFormation.ANNULEE]
)
def test_une_session_terminee_ne_bouge_plus(
    service: SessionFormationService,
    formation: Formation,
    terminal: StatutSessionFormation,
) -> None:
    """Rouvrir une session dispensée effacerait la trace de ce qui a eu lieu."""
    session = service.creer(_donnees(formation.id_formation))
    service.changer_statut(session.id_session, terminal)

    with pytest.raises(ConflitMetier):
        service.changer_statut(session.id_session, StatutSessionFormation.PLANIFIEE)


def test_une_session_terminee_n_accepte_plus_de_formateur(
    service: SessionFormationService, formation: Formation, formateur: Personnel
) -> None:
    session = service.creer(_donnees(formation.id_formation))
    service.changer_statut(session.id_session, StatutSessionFormation.ANNULEE)

    with pytest.raises(ConflitMetier):
        service.affecter_formateur(session.id_session, formateur.id_personnel)


def test_aucun_statut_complete(service: SessionFormationService) -> None:
    """Une session pleine se lit sur `places_restantes`, pas sur le statut.

    Deux sources pour un même fait divergeraient à la première annulation de
    réservation.
    """
    assert "Complete" not in [s.value for s in StatutSessionFormation]


# --- Modification -------------------------------------------------------------


def test_modification_partielle(
    service: SessionFormationService, formation: Formation
) -> None:
    session = service.creer(_donnees(formation.id_formation))

    service.modifier(
        session.id_session, SessionFormationUpdate(date_fin=date(2026, 9, 10))
    )

    assert session.date_fin == date(2026, 9, 10)
    assert session.date_debut == DEBUT


def test_modification_incoherente_sur_une_seule_date_refusee(
    service: SessionFormationService, formation: Formation
) -> None:
    """Le schema ne peut pas trancher : il ne voit qu'une des deux dates.

    L'autre est en base — même situation que la cohérence
    `est_personnalisable` / `supplement_personnalisation` en #24.
    """
    session = service.creer(_donnees(formation.id_formation))

    with pytest.raises(ReferenceInvalide):
        service.modifier(
            session.id_session, SessionFormationUpdate(date_fin=date(2026, 8, 1))
        )


def test_modification_refusee_sur_une_session_terminee(
    service: SessionFormationService, formation: Formation
) -> None:
    session = service.creer(_donnees(formation.id_formation))
    service.changer_statut(session.id_session, StatutSessionFormation.TERMINEE)

    with pytest.raises(ConflitMetier):
        service.modifier(session.id_session, SessionFormationUpdate(date_fin=FIN))


# --- Lecture et archivage -----------------------------------------------------


def test_obtenir_inconnue_leve_introuvable(service: SessionFormationService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(99999)


def test_filtre_par_formation(
    service: SessionFormationService, formation: Formation
) -> None:
    service.creer(_donnees(formation.id_formation))

    assert len(service.lister(formation.id_formation)) == 1
    assert service.lister(99999) == []


def test_archivage_rend_invisible(
    service: SessionFormationService, formation: Formation
) -> None:
    session = service.creer(_donnees(formation.id_formation))

    service.supprimer(session.id_session)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir(session.id_session)


# --- Garde-fou reporté depuis #34 ---------------------------------------------


def test_archiver_une_formation_avec_sessions_actives_refuse(
    service: SessionFormationService, formations: FormationService, formation: Formation
) -> None:
    service.creer(_donnees(formation.id_formation))

    with pytest.raises(ConflitMetier):
        formations.supprimer(formation.id_formation)


def test_archivage_permis_si_les_sessions_sont_archivees(
    service: SessionFormationService, formations: FormationService, formation: Formation
) -> None:
    """Le comptage **filtre** les archivées.

    Sans ce filtre, une formation dont toutes les sessions sont archivées
    deviendrait inarchivable à jamais.
    """
    session = service.creer(_donnees(formation.id_formation))
    service.supprimer(session.id_session)

    formations.supprimer(formation.id_formation)

    assert formation.supprime_le is not None
