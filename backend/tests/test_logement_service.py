"""Tests du service LOGEMENT, contre PostgreSQL uniquement.

`RESERVATION` est nécessaire au pré-contrôle d'archivage, et son `CHECK`
d'exclusivité utilise une syntaxe que SQLite refuse.

Le point de vigilance du module est le domaine de statut : il décrit **l'état du
bien**, jamais son occupation.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, RessourceIntrouvable
from app.core.security import hacher_mot_de_passe
from app.models.client import Client, TypeClient
from app.models.logement import StatutLogement
from app.models.reservation import Reservation, StatutReservation, TypeReservation
from app.schemas.logement import LogementCreate, LogementUpdate
from app.services.logement_service import LogementService

pytestmark = pytest.mark.postgres

DEBUT = datetime(2026, 9, 1, 14, 0, tzinfo=UTC)
FIN = DEBUT + timedelta(days=2)


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def service(db: Session) -> LogementService:
    return LogementService(db)


def _donnees(type_chambre: str = "Double", **extra: object) -> LogementCreate:
    parametres: dict = {
        "type_chambre": type_chambre,
        "capacite": 2,
        "tarif_nuitee": "45000.00",
    }
    parametres.update(extra)
    return LogementCreate(**parametres)


# --- Le domaine de statut -----------------------------------------------------


def test_aucune_valeur_designe_une_occupation() -> None:
    """Verrou de conception : l'occupation se déduit des réservations.

    L'inscrire dans le statut créerait deux sources pour un même fait, qui
    divergeraient à la première annulation — même raison que l'absence de
    « Complete » sur `SESSION_FORMATION`.

    Ce test tombera si quelqu'un ajoute « Occupe », même correctement
    implémenté.
    """
    valeurs = {s.value.lower() for s in StatutLogement}

    for interdit in ("occupe", "occupee", "reserve", "reservee", "libre"):
        assert interdit not in valeurs


def test_le_domaine_decrit_l_etat_du_bien() -> None:
    assert {s.value for s in StatutLogement} == {
        "Disponible",
        "En_maintenance",
        "Hors_service",
    }


def test_creation_naît_disponible(service: LogementService) -> None:
    """Un logement qu'on ajoute au catalogue est en principe louable."""
    logement = service.creer(_donnees())

    assert logement.statut is StatutLogement.DISPONIBLE


def test_statut_ne_peut_pas_venir_de_la_creation() -> None:
    """Le poser en maintenance est une décision explicite, prise ensuite."""
    charge = LogementCreate.model_validate(
        {
            "type_chambre": "Double",
            "capacite": 2,
            "tarif_nuitee": "45000.00",
            "statut": "Hors_service",
        }
    )

    assert not hasattr(charge, "statut")


def test_le_check_tient_hors_api(db: Session) -> None:
    """La garantie réelle est en base, pas dans le schema d'entrée."""
    with pytest.raises(IntegrityError) as capture:
        db.execute(
            text(
                "INSERT INTO logement (type_chambre, capacite, tarif_nuitee, statut)"
                " VALUES ('Suite', 2, 1.00, 'Occupe')"
            )
        )
        db.commit()
    db.rollback()

    assert "statut_logement" in str(capture.value)


def test_changement_de_statut(service: LogementService) -> None:
    """Changer l'état d'un bien est le travail courant d'un administrateur."""
    logement = service.creer(_donnees())

    service.modifier(
        logement.id_logement, LogementUpdate(statut=StatutLogement.EN_MAINTENANCE)
    )

    assert logement.statut is StatutLogement.EN_MAINTENANCE


def test_maintenance_et_hors_service_sont_distincts(service: LogementService) -> None:
    """L'un dit que le bien revient, l'autre qu'il est retiré de l'offre."""
    logement = service.creer(_donnees())

    service.modifier(
        logement.id_logement, LogementUpdate(statut=StatutLogement.EN_MAINTENANCE)
    )
    assert logement.statut is not StatutLogement.HORS_SERVICE

    service.modifier(
        logement.id_logement, LogementUpdate(statut=StatutLogement.HORS_SERVICE)
    )
    assert logement.statut is StatutLogement.HORS_SERVICE


# --- Bornes -------------------------------------------------------------------


def test_capacite_nulle_ou_negative_refusee() -> None:
    for capacite in (0, -2):
        with pytest.raises(ValueError):
            _donnees(capacite=capacite)


def test_tarif_negatif_refuse() -> None:
    with pytest.raises(ValueError):
        _donnees(tarif_nuitee="-1.00")


def test_tarif_nul_accepte(service: LogementService) -> None:
    """Un hébergement offert reste un cas légitime.

    Contrairement à `SALLE`, le tarif est ici obligatoire — il n'y a qu'une
    colonne, l'absence n'est pas représentable. La question du `CHECK` ne se
    pose donc pas.
    """
    logement = service.creer(_donnees(tarif_nuitee="0.00"))

    assert logement.tarif_nuitee == Decimal("0.00")


# --- Lecture ------------------------------------------------------------------


def test_obtenir_inconnu_leve_introuvable(service: LogementService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(99999)


def test_filtre_par_statut(service: LogementService) -> None:
    disponible = service.creer(_donnees("Simple"))
    en_travaux = service.creer(_donnees("Double"))
    service.modifier(
        en_travaux.id_logement, LogementUpdate(statut=StatutLogement.EN_MAINTENANCE)
    )

    trouves = service.lister(StatutLogement.DISPONIBLE)

    assert [item.id_logement for item in trouves] == [disponible.id_logement]


def test_filtre_par_capacite(service: LogementService) -> None:
    service.creer(_donnees("Simple", capacite=1))
    service.creer(_donnees("Familiale", capacite=6))

    assert [item.capacite for item in service.lister(capacite_minimale=4)] == [6]


def test_filtres_combines(service: LogementService) -> None:
    service.creer(_donnees("Simple", capacite=1))
    grande = service.creer(_donnees("Familiale", capacite=6))

    trouves = service.lister(StatutLogement.DISPONIBLE, capacite_minimale=4)

    assert [item.id_logement for item in trouves] == [grande.id_logement]


def test_combinaison_sans_resultat_donne_une_liste_vide(
    service: LogementService,
) -> None:
    """Critère de recherche, pas ressource désignée : liste vide, pas 404."""
    service.creer(_donnees(capacite=2))

    assert service.lister(capacite_minimale=100) == []


def test_le_filtre_masque_les_logements_archives(service: LogementService) -> None:
    logement = service.creer(_donnees())
    service.supprimer(logement.id_logement)

    assert service.lister() == []


def test_le_statut_ne_dit_rien_de_la_disponibilite(
    service: LogementService, db: Session
) -> None:
    """Un logement `Disponible` peut très bien être réservé la semaine prochaine.

    Savoir s'il est libre sur une période relève des `RESERVATION` (#47), pas de
    son statut. Ce test fige la distinction.
    """
    logement = service.creer(_donnees())
    _reservation(db, logement.id_logement, StatutReservation.CONFIRMEE)

    assert logement.statut is StatutLogement.DISPONIBLE
    assert service.lister(StatutLogement.DISPONIBLE) != []


# --- Archivage ----------------------------------------------------------------


def _reservation(
    db: Session, id_logement: int, statut: StatutReservation
) -> Reservation:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"jean_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(client)
    db.flush()
    reservation = Reservation(
        type_reservation=TypeReservation.LOGEMENT,
        date_debut=DEBUT,
        date_fin=FIN,
        nombre_personnes=1,
        statut=statut,
        id_client=client.id_client,
        id_logement=id_logement,
    )
    db.add(reservation)
    db.commit()
    return reservation


def test_archivage_refuse_si_reservations_actives(
    service: LogementService, db: Session
) -> None:
    logement = service.creer(_donnees())
    _reservation(db, logement.id_logement, StatutReservation.CONFIRMEE)

    with pytest.raises(ConflitMetier):
        service.supprimer(logement.id_logement)


def test_une_reservation_annulee_ne_retient_plus_le_logement(
    service: LogementService, db: Session
) -> None:
    """Sans ce filtre, un logement dont tout a été annulé serait inarchivable."""
    logement = service.creer(_donnees())
    _reservation(db, logement.id_logement, StatutReservation.ANNULEE)

    service.supprimer(logement.id_logement)

    assert logement.supprime_le is not None


def test_archiver_n_est_pas_mettre_hors_service(service: LogementService) -> None:
    """Deux notions distinctes.

    Archiver retire la ligne des lectures ; `Hors_service` dit que le bien
    existe mais n'est pas louable. Un logement en travaux reste au catalogue de
    gestion.
    """
    logement = service.creer(_donnees())
    service.modifier(
        logement.id_logement, LogementUpdate(statut=StatutLogement.HORS_SERVICE)
    )

    assert service.obtenir(logement.id_logement) is not None
    assert logement.supprime_le is None


def test_restauration(service: LogementService) -> None:
    logement = service.creer(_donnees())
    service.supprimer(logement.id_logement)

    service.restaurer(logement.id_logement)

    assert service.obtenir(logement.id_logement) is not None


def test_restauration_idempotente(service: LogementService) -> None:
    logement = service.creer(_donnees())

    assert service.restaurer(logement.id_logement).id_logement == logement.id_logement
