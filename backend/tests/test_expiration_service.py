"""Expiration des impayés (13 octobre 2026).

Une commande non payée est annulée après 2 h, son stock rendu ; une
réservation sans acompte après 24 h, ses places rendues. Les données sont
vieillies directement en base, puis `ExpirationService.expirer` est appelé.
"""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.models.categorie_produit import CategorieProduit
from app.models.commande import Commande
from app.models.produit import Produit
from app.models.reservation import Reservation
from app.models.session_formation import SessionFormation
from app.services.expiration_service import ExpirationService
from tests.test_reservation_router import _compte, _corps, _entete, _session_ouverte

pytestmark = pytest.mark.postgres

COMMANDES = f"{settings.API_V1_PREFIX}/commandes"
RESERVATIONS = f"{settings.API_V1_PREFIX}/reservations"
MVOLA = {
    "methode": "Mobile_money",
    "fournisseur": "Mvola",
    "numero_mobile_money": "034 12 345 67",
}


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def client_http(db: Session) -> Iterator[TestClient]:
    def _get_db() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as testeur:
            yield testeur
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def gateau(db: Session) -> Produit:
    categorie = CategorieProduit(libelle=f"Cat {uuid4().hex[:6]}")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Gâteau",
        prix_unitaire=Decimal("5000.00"),
        unite_mesure="piece",
        stock_disponible=10,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def _commande_invitee(client_http: TestClient, produit: Produit) -> dict:
    reponse = client_http.post(
        f"{COMMANDES}/invite",
        json={
            "type_commande": "A_emporter",
            "nom_invite": "Rasoa",
            "contact_invite": "0341234567",
            "lignes": [{"id_produit": produit.id_produit, "quantite": 3}],
        },
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


def _vieillir_commande(db: Session, id_commande: int, heures: float) -> None:
    db.execute(
        update(Commande)
        .where(Commande.id_commande == id_commande)
        .values(date_commande=datetime.now(UTC) - timedelta(hours=heures))
    )
    db.commit()


def _statut_commande(db: Session, id_commande: int) -> str:
    db.expire_all()
    return db.get(Commande, id_commande).statut.value


# --- Commandes -------------------------------------------------------------


def test_une_commande_impayee_depuis_plus_de_2_h_est_annulee_et_rend_son_stock(
    client_http: TestClient, db: Session, gateau: Produit
) -> None:
    commande = _commande_invitee(client_http, gateau)
    _vieillir_commande(db, commande["id_commande"], heures=3)

    bilan = ExpirationService(db).expirer()

    assert commande["id_commande"] in bilan.commandes
    assert _statut_commande(db, commande["id_commande"]) == "Annulee"
    db.refresh(gateau)
    assert gateau.stock_disponible == 10


def test_une_commande_recente_n_est_pas_touchee(
    client_http: TestClient, db: Session, gateau: Produit
) -> None:
    commande = _commande_invitee(client_http, gateau)
    _vieillir_commande(db, commande["id_commande"], heures=1)

    ExpirationService(db).expirer()

    assert _statut_commande(db, commande["id_commande"]) == "En_attente"


def test_une_commande_saisie_par_le_personnel_n_expire_jamais(
    client_http: TestClient, db: Session, gateau: Produit
) -> None:
    """Elle se règle au comptoir : l'annuler ferait perdre une vente réelle."""
    from app.models.personnel import FonctionPersonnel, Personnel

    salarie = Personnel(
        nom="Caisse",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=f"caisse_{uuid4().hex[:8]}@delta.mg",
    )
    db.add(salarie)
    db.commit()
    commande = _commande_invitee(client_http, gateau)
    db.execute(
        update(Commande)
        .where(Commande.id_commande == commande["id_commande"])
        .values(id_personnel=salarie.id_personnel)
    )
    _vieillir_commande(db, commande["id_commande"], heures=10)

    ExpirationService(db).expirer()

    assert _statut_commande(db, commande["id_commande"]) == "En_attente"


def test_un_paiement_en_cours_epargne_la_commande(
    client_http: TestClient, db: Session, gateau: Produit
) -> None:
    """Le client valide peut-être sur son téléphone en ce moment même."""
    commande = _commande_invitee(client_http, gateau)
    client_http.post(
        f"{COMMANDES}/invite/{commande['reference_publique']}/paiements", json=MVOLA
    )
    _vieillir_commande(db, commande["id_commande"], heures=3)

    ExpirationService(db).expirer()

    assert _statut_commande(db, commande["id_commande"]) == "En_attente"


def test_une_passe_rejouee_n_annule_rien_de_plus(
    client_http: TestClient, db: Session, gateau: Produit
) -> None:
    commande = _commande_invitee(client_http, gateau)
    _vieillir_commande(db, commande["id_commande"], heures=3)
    ExpirationService(db).expirer()

    second = ExpirationService(db).expirer()

    assert commande["id_commande"] not in second.commandes
    db.refresh(gateau)
    assert gateau.stock_disponible == 10


# --- Réservations ----------------------------------------------------------


def _vieillir_reservation(db: Session, id_reservation: int, heures: float) -> None:
    db.execute(
        update(Reservation)
        .where(Reservation.id_reservation == id_reservation)
        .values(date_reservation=datetime.now(UTC) - timedelta(hours=heures))
    )
    db.commit()


def test_une_reservation_sans_acompte_depuis_24_h_est_annulee_et_rend_ses_places(
    client_http: TestClient, db: Session
) -> None:
    session: SessionFormation = _session_ouverte(db, capacite=12)
    entete = _entete(_compte(db, "expire"))
    reservation = client_http.post(
        RESERVATIONS, json=_corps(session.id_session, 2), headers=entete
    ).json()
    _vieillir_reservation(db, reservation["id_reservation"], heures=25)

    bilan = ExpirationService(db).expirer()

    assert reservation["id_reservation"] in bilan.reservations
    db.expire_all()
    assert db.get(Reservation, reservation["id_reservation"]).statut.value == (
        "Annulee"
    )
    assert db.get(SessionFormation, session.id_session).places_restantes == 12


def test_une_reservation_dont_l_acompte_est_paye_n_expire_pas(
    client_http: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "developpement")
    session = _session_ouverte(db)
    entete = _entete(_compte(db, "payee"))
    reservation = client_http.post(
        RESERVATIONS, json=_corps(session.id_session), headers=entete
    ).json()
    paiement = client_http.post(
        f"{RESERVATIONS}/{reservation['id_reservation']}/paiements",
        json=MVOLA,
        headers=entete,
    ).json()
    client_http.post(
        f"{settings.API_V1_PREFIX}/paiements/{paiement['id_paiement']}"
        "/simuler-confirmation",
        headers=entete,
    )
    _vieillir_reservation(db, reservation["id_reservation"], heures=48)

    bilan = ExpirationService(db).expirer()

    assert reservation["id_reservation"] not in bilan.reservations
