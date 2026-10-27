"""Tests de `LogementRepository.premier_libre`, contre PostgreSQL uniquement.

Le prédicat de chevauchement reproduit celui de la contrainte d'exclusion
`logement_sans_chevauchement`, qui n'existe que sur PostgreSQL.

**Capacité distinctive.** La base de développement porte d'autres logements, et
`premier_libre` retient le plus petit identifiant : sans discriminant, ces tests
dépendraient de données qu'ils ne créent pas. Une capacité que rien d'autre
n'atteint isole les chambres de sonde sans toucher au reste.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.core.security import hacher_mot_de_passe
from app.models.client import Client, TypeClient
from app.models.logement import Logement, StatutLogement
from app.models.reservation import Reservation, StatutReservation, TypeReservation
from app.repositories.logement_repository import LogementRepository

pytestmark = pytest.mark.postgres

DEBUT = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
FIN = DEBUT + timedelta(days=4)
CAPACITE = 96


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def depot(db: Session) -> LogementRepository:
    return LogementRepository(db)


def _chambre(
    db: Session,
    statut: StatutLogement = StatutLogement.DISPONIBLE,
    capacite: int = CAPACITE,
) -> Logement:
    logement = Logement(
        type_chambre=f"Sonde {uuid4().hex[:6]}",
        capacite=capacite,
        tarif_nuitee=Decimal("80000.00"),
        statut=statut,
    )
    db.add(logement)
    db.commit()
    return logement


def _client(db: Session) -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"sonde_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(compte)
    db.commit()
    return compte


def _reserver(
    db: Session,
    logement: Logement,
    debut: datetime = DEBUT,
    fin: datetime = FIN,
    statut: StatutReservation = StatutReservation.CONFIRMEE,
) -> Reservation:
    reservation = Reservation(
        type_reservation=TypeReservation.LOGEMENT,
        date_debut=debut,
        date_fin=fin,
        nombre_personnes=1,
        statut=statut,
        id_client=_client(db).id_client,
        id_logement=logement.id_logement,
    )
    db.add(reservation)
    db.commit()
    return reservation


def test_une_chambre_libre_est_retournee(
    depot: LogementRepository, db: Session
) -> None:
    chambre = _chambre(db)

    assert depot.premier_libre(DEBUT, FIN, 1) is not None
    assert depot.premier_libre(DEBUT, FIN, CAPACITE).id_logement == chambre.id_logement


def test_une_chambre_occupee_est_ecartee(
    depot: LogementRepository, db: Session
) -> None:
    chambre = _chambre(db)
    _reserver(db, chambre)

    assert depot.premier_libre(DEBUT, FIN, CAPACITE) is None


def test_une_reservation_annulee_libere_le_creneau(
    depot: LogementRepository, db: Session
) -> None:
    """Même prédicat que la contrainte d'exclusion : sans lui, une annulation
    condamnerait le créneau à jamais."""
    chambre = _chambre(db)
    _reserver(db, chambre, statut=StatutReservation.ANNULEE)

    assert depot.premier_libre(DEBUT, FIN, CAPACITE).id_logement == chambre.id_logement


def test_une_reservation_archivee_libere_le_creneau(
    depot: LogementRepository, db: Session
) -> None:
    chambre = _chambre(db)
    reservation = _reserver(db, chambre)
    reservation.supprime_le = datetime.now(UTC)
    db.commit()

    assert depot.premier_libre(DEBUT, FIN, CAPACITE).id_logement == chambre.id_logement


def test_un_creneau_adjacent_ne_chevauche_pas(
    depot: LogementRepository, db: Session
) -> None:
    """Bornes `[)` : une chambre libérée à midi est réservable à midi.

    Le contraire imposerait un trou artificiel entre deux séjours — et
    divergerait de la contrainte d'exclusion, qui accepterait ce que ce
    pré-contrôle aurait refusé.
    """
    chambre = _chambre(db)
    _reserver(db, chambre, debut=FIN, fin=FIN + timedelta(days=2))

    assert depot.premier_libre(DEBUT, FIN, CAPACITE).id_logement == chambre.id_logement


def test_un_chevauchement_partiel_ecarte_la_chambre(
    depot: LogementRepository, db: Session
) -> None:
    chambre = _chambre(db)
    _reserver(db, chambre, debut=FIN - timedelta(days=1), fin=FIN + timedelta(days=2))

    assert depot.premier_libre(DEBUT, FIN, CAPACITE) is None


@pytest.mark.parametrize(
    "statut", [StatutLogement.EN_MAINTENANCE, StatutLogement.HORS_SERVICE]
)
def test_une_chambre_non_louable_est_ecartee(
    depot: LogementRepository, db: Session, statut: StatutLogement
) -> None:
    """L'état du bien prime sur son occupation : une chambre en maintenance
    n'est pas attribuable, même sur un créneau totalement libre."""
    _chambre(db, statut=statut)

    assert depot.premier_libre(DEBUT, FIN, CAPACITE) is None


def test_une_chambre_archivee_est_ecartee(
    depot: LogementRepository, db: Session
) -> None:
    chambre = _chambre(db)
    chambre.supprime_le = datetime.now(UTC)
    db.commit()

    assert depot.premier_libre(DEBUT, FIN, CAPACITE) is None


def test_une_chambre_trop_petite_est_ecartee(
    depot: LogementRepository, db: Session
) -> None:
    _chambre(db, capacite=CAPACITE)

    assert depot.premier_libre(DEBUT, FIN, CAPACITE + 1) is None


def test_le_choix_est_deterministe(depot: LogementRepository, db: Session) -> None:
    """« La première libre » doit désigner la même chambre d'un appel à
    l'autre, sans quoi aucun test ne serait reproductible."""
    premiere = _chambre(db)
    _chambre(db)

    assert depot.premier_libre(DEBUT, FIN, CAPACITE).id_logement == premiere.id_logement
    assert depot.premier_libre(DEBUT, FIN, CAPACITE).id_logement == premiere.id_logement
