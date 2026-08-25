"""Tests du service SALLE, contre PostgreSQL uniquement.

`RESERVATION` est nécessaire au pré-contrôle d'archivage, et son `CHECK`
d'exclusivité utilise la syntaxe PostgreSQL `(colonne IS NOT NULL)::int`, que
SQLite refuse.

Le point central est le `CHECK` des tarifs : il rétablit une règle du
dictionnaire d'origine, jamais portée en contrainte jusqu'ici.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflitMetier,
    ReferenceInvalide,
    RessourceIntrouvable,
)
from app.core.security import hacher_mot_de_passe
from app.models.client import Client, TypeClient
from app.models.reservation import Reservation, StatutReservation, TypeReservation
from app.schemas.salle import SalleCreate, SalleUpdate
from app.services.salle_service import SalleService

pytestmark = pytest.mark.postgres

DEBUT = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
FIN = DEBUT + timedelta(hours=4)


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def service(db: Session) -> SalleService:
    return SalleService(db)


def _donnees(nom: str = "Salle Ravinala", **extra: object) -> SalleCreate:
    parametres: dict = {"nom": nom, "capacite": 20, "tarif_horaire": "15000.00"}
    parametres.update(extra)
    return SalleCreate(**parametres)


# --- Le CHECK des tarifs ------------------------------------------------------


def test_salle_sans_aucun_tarif_refusee_par_le_schema() -> None:
    """Sans cette règle, la salle serait louable gratuitement sans décision."""
    with pytest.raises(ValueError):
        SalleCreate(nom="Sans tarif", capacite=20)


def test_tarif_horaire_seul_accepte(service: SalleService) -> None:
    """Une salle louée à l'heure seulement est le cas courant."""
    salle = service.creer(_donnees(tarif_horaire="15000.00", tarif_journee=None))

    assert salle.tarif_horaire == Decimal("15000.00")
    assert salle.tarif_journee is None


def test_tarif_journee_seul_accepte(service: SalleService) -> None:
    salle = service.creer(_donnees(tarif_horaire=None, tarif_journee="90000.00"))

    assert salle.tarif_journee == Decimal("90000.00")


def test_la_gratuite_doit_etre_ecrite(service: SalleService) -> None:
    """`0.00` est accepté : la gratuité est une décision, pas une absence.

    C'est tout l'intérêt de la contrainte — elle ne l'interdit pas, elle
    l'oblige à être explicite.
    """
    salle = service.creer(_donnees(tarif_horaire="0.00"))

    assert salle.tarif_horaire == Decimal("0.00")


def test_le_check_tient_hors_api(db: Session) -> None:
    """La garantie réelle est en base, pas dans le schema d'entrée.

    Une reprise de données ou une correction manuelle ne doit pas pouvoir créer
    ce trou.
    """
    with pytest.raises(IntegrityError) as capture:
        db.execute(
            text("INSERT INTO salle (nom, capacite) VALUES ('Contournement', 10)")
        )
        db.commit()
    db.rollback()

    assert "au_moins_un_tarif" in str(capture.value)


def test_modification_ne_peut_pas_retirer_le_dernier_tarif(
    service: SalleService,
) -> None:
    """422 : l'opération laisserait la salle sans tarif."""
    salle = service.creer(_donnees(tarif_horaire="15000.00", tarif_journee=None))

    with pytest.raises(ReferenceInvalide):
        service.modifier(salle.id_salle, SalleUpdate(tarif_horaire=None))


def test_modification_peut_retirer_un_tarif_si_l_autre_reste(
    service: SalleService,
) -> None:
    """Le schema seul ne pourrait pas trancher : il ne voit qu'un des deux.

    L'autre est en base — même situation que la cohérence
    `est_personnalisable` / `supplement_personnalisation` en #24.
    """
    salle = service.creer(_donnees(tarif_horaire="15000.00", tarif_journee="90000.00"))

    service.modifier(salle.id_salle, SalleUpdate(tarif_horaire=None))

    assert salle.tarif_horaire is None
    assert salle.tarif_journee == Decimal("90000.00")


# --- Bornes -------------------------------------------------------------------


def test_capacite_nulle_ou_negative_refusee() -> None:
    """Une salle de zéro place n'est pas une salle."""
    for capacite in (0, -5):
        with pytest.raises(ValueError):
            _donnees(capacite=capacite)


def test_tarif_negatif_refuse() -> None:
    with pytest.raises(ValueError):
        _donnees(tarif_horaire="-1.00")


# --- Lecture ------------------------------------------------------------------


def test_obtenir_inconnue_leve_introuvable(service: SalleService) -> None:
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(99999)


def test_obtenir_archivee_leve_introuvable(service: SalleService) -> None:
    salle = service.creer(_donnees())
    service.supprimer(salle.id_salle)

    with pytest.raises(RessourceIntrouvable):
        service.obtenir(salle.id_salle)


def test_filtre_par_capacite(service: SalleService) -> None:
    service.creer(_donnees("Petite", capacite=10))
    service.creer(_donnees("Grande", capacite=50))

    assert [s.nom for s in service.lister(30)] == ["Grande"]


def test_capacite_inatteignable_donne_une_liste_vide(service: SalleService) -> None:
    """Critère de recherche, pas ressource désignée : liste vide, pas 404."""
    service.creer(_donnees(capacite=20))

    assert service.lister(1000) == []


def test_le_filtre_masque_les_salles_archivees(service: SalleService) -> None:
    """Sans ce filtre, le catalogue filtré montrerait ce que le complet masque."""
    salle = service.creer(_donnees(capacite=50))
    service.supprimer(salle.id_salle)

    assert service.lister(10) == []


# --- Archivage ----------------------------------------------------------------


def _reservation(db: Session, id_salle: int, statut: StatutReservation) -> Reservation:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"jean_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(client)
    db.flush()
    reservation = Reservation(
        type_reservation=TypeReservation.SALLE,
        date_debut=DEBUT,
        date_fin=FIN,
        nombre_personnes=1,
        statut=statut,
        id_client=client.id_client,
        id_salle=id_salle,
    )
    db.add(reservation)
    db.commit()
    return reservation


def test_archivage_refuse_si_reservations_actives(
    service: SalleService, db: Session
) -> None:
    """On ne retire pas du catalogue une salle que quelqu'un a réservée."""
    salle = service.creer(_donnees())
    _reservation(db, salle.id_salle, StatutReservation.CONFIRMEE)

    with pytest.raises(ConflitMetier):
        service.supprimer(salle.id_salle)


def test_une_reservation_annulee_ne_retient_plus_la_salle(
    service: SalleService, db: Session
) -> None:
    """Sans ce filtre, une salle dont tout a été annulé serait inarchivable."""
    salle = service.creer(_donnees())
    _reservation(db, salle.id_salle, StatutReservation.ANNULEE)

    service.supprimer(salle.id_salle)

    assert salle.supprime_le is not None


def test_archivage_sans_reservation(service: SalleService) -> None:
    salle = service.creer(_donnees())

    service.supprimer(salle.id_salle)

    assert salle.supprime_le is not None


# --- Restauration -------------------------------------------------------------


def test_restauration(service: SalleService) -> None:
    salle = service.creer(_donnees())
    service.supprimer(salle.id_salle)

    service.restaurer(salle.id_salle)

    assert service.obtenir(salle.id_salle) is not None


def test_restauration_idempotente(service: SalleService) -> None:
    salle = service.creer(_donnees())

    assert service.restaurer(salle.id_salle).id_salle == salle.id_salle


def test_deux_salles_peuvent_porter_le_meme_nom(service: SalleService) -> None:
    """`SALLE` ne porte aucune unicité : deux sites peuvent avoir une « Salle A ».

    C'est ce qui rend la restauration incapable d'échouer, contrairement à
    `DOMAINE_FORMATION` dont le libellé est unique.
    """
    service.creer(_donnees("Salle A"))
    seconde = service.creer(_donnees("Salle A"))

    assert seconde.id_salle is not None
