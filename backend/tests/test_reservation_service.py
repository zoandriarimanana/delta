"""Tests du service RESERVATION, contre PostgreSQL uniquement.

SQLite ne peut pas porter ces tests : le `CHECK` d'exclusivité de `RESERVATION`
utilise la syntaxe PostgreSQL `(colonne IS NOT NULL)::int`, que SQLite refuse
(« unrecognized token: ":" »).

Le cœur du module est `test_cycle_complet_la_place_revient_en_circulation` : deux
tests séparés ne prouveraient pas que la place est réellement rendue.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text, update
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.core.security import hacher_mot_de_passe
from app.models.client import Client, TypeClient
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.personnel import FonctionPersonnel, Personnel
from app.models.reservation import StatutReservation, TypeReservation
from app.models.session_formation import SessionFormation, StatutSessionFormation
from app.schemas.reservation import ReservationCreate
from app.services.reservation_service import ReservationService

pytestmark = pytest.mark.postgres

DEBUT = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
FIN = DEBUT + timedelta(days=4)


@pytest.fixture
def db(session_postgres: Session) -> Session:
    """Alias local : tous les tests de ce module passent par PostgreSQL."""
    return session_postgres


@pytest.fixture
def service(db: Session) -> ReservationService:
    return ReservationService(db)


def _client(db: Session, prefixe: str = "jean") -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"{prefixe}_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(compte)
    db.commit()
    return compte


@pytest.fixture
def client(db: Session) -> Client:
    return _client(db)


def _session_ouverte(db: Session, capacite: int = 12) -> SessionFormation:
    """Session prête à recevoir des réservations."""
    domaine = DomaineFormation(libelle=f"Domaine {uuid4().hex[:8]}")
    db.add(domaine)
    db.flush()
    formation = Formation(
        titre="CAP Pâtissier",
        duree_heures=140,
        prix=Decimal("850000.00"),
        capacite_max=capacite,
        id_domaine=domaine.id_domaine,
    )
    db.add(formation)
    db.flush()
    formateur = Personnel(
        nom="Rakoto",
        prenom="Jean",
        fonction=FonctionPersonnel.FORMATEUR,
        email=f"formateur_{uuid4().hex[:8]}@delta.mg",
    )
    db.add(formateur)
    db.flush()
    session = SessionFormation(
        date_debut=DEBUT.date(),
        date_fin=FIN.date(),
        places_restantes=capacite,
        statut=StatutSessionFormation.OUVERTE,
        id_formation=formation.id_formation,
        id_formateur=formateur.id_personnel,
    )
    db.add(session)
    db.commit()
    return session


@pytest.fixture
def session_ouverte(db: Session) -> SessionFormation:
    return _session_ouverte(db)


def _donnees(id_session: int, nombre: int = 1) -> ReservationCreate:
    return ReservationCreate(
        type_reservation=TypeReservation.FORMATION,
        date_debut=DEBUT,
        date_fin=FIN,
        nombre_personnes=nombre,
        id_session=id_session,
    )


# --- Création et décrément ----------------------------------------------------


def test_creation_decremente_les_places(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    service.creer(_donnees(session_ouverte.id_session, nombre=3), client)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 9


def test_statut_initial_impose_par_le_serveur(
    service: ReservationService, client: Client, session_ouverte: SessionFormation
) -> None:
    reservation = service.creer(_donnees(session_ouverte.id_session), client)

    assert reservation.statut is StatutReservation.EN_ATTENTE


def test_statut_ne_peut_pas_venir_de_la_requete() -> None:
    """Le schema n'expose pas le champ : l'envoyer n'a aucun effet."""
    charge = ReservationCreate.model_validate(
        {
            "type_reservation": "Formation",
            "date_debut": DEBUT.isoformat(),
            "date_fin": FIN.isoformat(),
            "id_session": 1,
            "statut": "Honoree",
            "id_client": 999,
        }
    )

    assert not hasattr(charge, "statut")
    assert not hasattr(charge, "id_client")


def test_places_insuffisantes_leve_un_conflit(
    service: ReservationService, client: Client, db: Session
) -> None:
    """409, avec un message qui dit ce qui reste."""
    session = _session_ouverte(db, capacite=2)

    with pytest.raises(ConflitMetier) as capture:
        service.creer(_donnees(session.id_session, nombre=3), client)

    assert "2" in str(capture.value)


def test_refus_n_ecrit_aucune_reservation(
    service: ReservationService, client: Client, db: Session
) -> None:
    """Le décrément précède l'insertion : rien n'est écrit s'il échoue."""
    session = _session_ouverte(db, capacite=1)

    with pytest.raises(ConflitMetier):
        service.creer(_donnees(session.id_session, nombre=5), client)

    assert service.lister_du_client(client) == []
    db.refresh(session)
    assert session.places_restantes == 1


def test_session_inexistante_leve_reference_invalide(
    service: ReservationService, client: Client
) -> None:
    """422 : la référence est dans le corps, pas dans l'URL."""
    with pytest.raises(ReferenceInvalide):
        service.creer(_donnees(99999), client)


@pytest.mark.parametrize(
    "statut",
    [
        StatutSessionFormation.PLANIFIEE,
        StatutSessionFormation.TERMINEE,
        StatutSessionFormation.ANNULEE,
    ],
)
def test_session_non_ouverte_refusee(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
    statut: StatutSessionFormation,
) -> None:
    """Seule une session `Ouverte` accepte des réservations."""
    session_ouverte.statut = statut
    db.commit()

    with pytest.raises(ConflitMetier):
        service.creer(_donnees(session_ouverte.id_session), client)


def test_formation_sans_session_refusee_par_le_schema() -> None:
    """Le `CHECK` d'exclusivité autorise zéro cible — c'est la règle du type
    Formation qui l'exige, et elle croise deux colonnes."""
    with pytest.raises(ValueError):
        ReservationCreate(
            type_reservation=TypeReservation.FORMATION,
            date_debut=DEBUT,
            date_fin=FIN,
        )


def test_dates_inversees_refusees() -> None:
    with pytest.raises(ValueError):
        ReservationCreate(
            type_reservation=TypeReservation.FORMATION,
            date_debut=FIN,
            date_fin=DEBUT,
            id_session=1,
        )


@pytest.mark.parametrize(
    "type_reservation", [TypeReservation.SALLE, TypeReservation.LOGEMENT]
)
def test_types_non_livres_refuses(type_reservation: TypeReservation) -> None:
    """Accepter une réservation qu'aucun service ne sait honorer laisserait une
    ligne orpheline. `SALLE` et `LOGEMENT` arrivent au sprint 5."""
    with pytest.raises(ValueError):
        ReservationCreate(
            type_reservation=type_reservation,
            date_debut=DEBUT,
            date_fin=FIN,
        )


# --- Restitution --------------------------------------------------------------


def test_annulation_restitue_la_place(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    reservation = service.creer(_donnees(session_ouverte.id_session, nombre=2), client)
    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 10

    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 12


def test_la_restitution_est_idempotente(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """Annuler deux fois ne crédite pas deux fois.

    Sans cette garde, chaque appel répété gonflerait le compteur et la session
    finirait par afficher plus de places qu'elle n'en a.
    """
    reservation = service.creer(_donnees(session_ouverte.id_session), client)
    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)

    # Rejouer la même transition est sans effet.
    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 12


def test_une_reservation_annulee_ne_change_plus_de_statut(
    service: ReservationService, client: Client, session_ouverte: SessionFormation
) -> None:
    """Le permettre supposerait de re-décrémenter, donc de pouvoir échouer faute
    de places — une transition de statut qui échoue par capacité serait un
    piège."""
    reservation = service.creer(_donnees(session_ouverte.id_session), client)
    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)

    with pytest.raises(ConflitMetier):
        service.changer_statut(reservation.id_reservation, StatutReservation.CONFIRMEE)


def test_honorer_ne_restitue_pas(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """Un stagiaire venu a consommé sa place.

    La rendre ferait réapparaître de la disponibilité qui n'existe pas.
    """
    reservation = service.creer(_donnees(session_ouverte.id_session), client)

    service.changer_statut(reservation.id_reservation, StatutReservation.HONOREE)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 11


def test_confirmer_ne_change_pas_le_compteur(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """La place était déjà retenue dès la création."""
    reservation = service.creer(_donnees(session_ouverte.id_session), client)

    service.changer_statut(reservation.id_reservation, StatutReservation.CONFIRMEE)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 11


def test_archivage_restitue_aussi(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    """Une réservation archivée ne doit plus immobiliser de place.

    Ne pas restituer ici laisserait le même trou que l'annulation évite, par un
    autre chemin.
    """
    reservation = service.creer(_donnees(session_ouverte.id_session, nombre=4), client)

    service.supprimer(reservation.id_reservation)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 12


def test_archiver_une_annulee_ne_credite_pas_deux_fois(
    service: ReservationService,
    client: Client,
    session_ouverte: SessionFormation,
    db: Session,
) -> None:
    reservation = service.creer(_donnees(session_ouverte.id_session), client)
    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)

    service.supprimer(reservation.id_reservation)

    db.refresh(session_ouverte)
    assert session_ouverte.places_restantes == 12


# --- Le test qui prouve quelque chose -----------------------------------------


def test_cycle_complet_la_place_revient_en_circulation(
    service: ReservationService, db: Session
) -> None:
    """Le cœur de l'issue, en un seul test.

    Un client prend la dernière place, un tiers se voit refuser, le premier
    annule, le tiers réussit. Deux tests séparés — « l'annulation crédite » et
    « la réservation décrémente » — passeraient tous les deux sans prouver que
    la place est **réellement revenue en circulation**.
    """
    session = _session_ouverte(db, capacite=1)
    premier = _client(db, "premier")
    tiers = _client(db, "tiers")

    service.creer(_donnees(session.id_session), premier)
    db.refresh(session)
    assert session.places_restantes == 0

    with pytest.raises(ConflitMetier):
        service.creer(_donnees(session.id_session), tiers)

    reservation = service.lister_du_client(premier)[0]
    service.changer_statut(reservation.id_reservation, StatutReservation.ANNULEE)
    db.refresh(session)
    assert session.places_restantes == 1

    reussie = service.creer(_donnees(session.id_session), tiers)

    assert reussie.id_client == tiers.id_client
    db.refresh(session)
    assert session.places_restantes == 0


def test_deux_decrements_concurrents_sur_la_derniere_place(
    service: ReservationService, db: Session
) -> None:
    """C'est PostgreSQL qui arbitre, pas l'application.

    La valeur est remise à 1 **par SQL**, sans toucher l'objet en session :
    modifier l'attribut le rendrait « sale » et déclencherait un autoflush avant
    l'`UPDATE` conditionnel, ce qui fausserait la mesure. Même précaution que
    dans `test_commande_service.py`.
    """
    session = _session_ouverte(db, capacite=1)
    premier = _client(db, "premier")
    second = _client(db, "second")

    assert service.sessions.decrementer_places(session.id_session, 1) is True
    assert service.sessions.decrementer_places(session.id_session, 1) is False

    db.execute(
        update(SessionFormation)
        .where(SessionFormation.id_session == session.id_session)
        .values(places_restantes=1)
        .execution_options(synchronize_session=False)
    )
    db.commit()

    service.creer(_donnees(session.id_session), premier)
    with pytest.raises(ConflitMetier):
        service.creer(_donnees(session.id_session), second)

    reste = db.execute(
        text("SELECT places_restantes FROM session_formation WHERE id_session = :i"),
        {"i": session.id_session},
    ).scalar()
    assert reste == 0


# --- Isolation entre clients --------------------------------------------------


def test_la_reservation_d_autrui_est_introuvable(
    service: ReservationService, session_ouverte: SessionFormation, db: Session
) -> None:
    """404 et non 403 : confirmer son existence renseignerait déjà."""
    proprietaire = _client(db, "proprietaire")
    autre = _client(db, "autre")
    reservation = service.creer(_donnees(session_ouverte.id_session), proprietaire)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir_du_client(reservation.id_reservation, autre)


def test_historique_isole_les_clients(
    service: ReservationService, session_ouverte: SessionFormation, db: Session
) -> None:
    premier = _client(db, "premier")
    second = _client(db, "second")
    service.creer(_donnees(session_ouverte.id_session), premier)
    service.creer(_donnees(session_ouverte.id_session), second)

    assert len(service.lister_du_client(premier)) == 1
    assert len(service.lister_du_client(second)) == 1
