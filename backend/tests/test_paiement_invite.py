"""Paiement d'une commande passée sans compte (9 octobre 2026).

L'invité paie dès la validation, par mobile money. Sa seule clé est la
référence publique de sa commande — un UUID —, la même qui lui permet de la
consulter. Contre PostgreSQL : `COMMANDE` référence `RESERVATION`.
"""

from collections.abc import Iterator
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.models.categorie_produit import CategorieProduit
from app.models.paiement import Paiement
from app.models.produit import Produit
from app.schemas.paiement import PaiementCreate, normaliser_numero

pytestmark = pytest.mark.postgres

COMMANDES = f"{settings.API_V1_PREFIX}/commandes"
PAIEMENTS = f"{settings.API_V1_PREFIX}/paiements"
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
def reference(client_http: TestClient, db: Session) -> str:
    """Une commande invitée de 7 000 Ar, et sa référence publique."""
    categorie = CategorieProduit(libelle=f"Cat {uuid4().hex[:6]}")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Gâteau",
        prix_unitaire=Decimal("3500.00"),
        unite_mesure="piece",
        stock_disponible=10,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.commit()
    reponse = client_http.post(
        f"{COMMANDES}/invite",
        json={
            "type_commande": "A_emporter",
            "nom_invite": "Rasoa",
            "contact_invite": "0341234567",
            "lignes": [{"id_produit": produit.id_produit, "quantite": 2}],
        },
    )
    assert reponse.status_code == 201
    return reponse.json()["reference_publique"]


def _payer(client_http: TestClient, reference: str, corps: dict) -> object:
    return client_http.post(f"{COMMANDES}/invite/{reference}/paiements", json=corps)


# --- Initiation ------------------------------------------------------------------


def test_un_invite_paie_sa_commande_par_mobile_money(
    client_http: TestClient, reference: str
) -> None:
    reponse = _payer(client_http, reference, MVOLA)

    assert reponse.status_code == 201
    corps = reponse.json()
    assert corps["statut"] == "En_attente"
    assert corps["montant"] == "7000.00"
    assert corps["fournisseur"] == "Mvola"
    # Le numéro est transmis à l'opérateur, jamais renvoyé ni stocké.
    assert "numero_mobile_money" not in corps


def test_le_numero_n_est_jamais_stocke(
    client_http: TestClient, db: Session, reference: str
) -> None:
    _payer(client_http, reference, MVOLA)

    colonnes = {c.name for c in Paiement.__table__.columns}
    assert not any("numero" in c or "telephone" in c for c in colonnes)


def test_une_reference_inconnue_repond_404(client_http: TestClient) -> None:
    reponse = _payer(client_http, str(uuid4()), MVOLA)

    assert reponse.status_code == 404


@pytest.mark.parametrize(
    ("corps", "message"),
    [
        ({"methode": "Mobile_money", "fournisseur": "Mvola"}, "numéro"),
        ({**MVOLA, "numero_mobile_money": "0321234567"}, "MVola"),
        ({**MVOLA, "fournisseur": "Airtel_money"}, "Airtel Money"),
        ({**MVOLA, "numero_mobile_money": "12345"}, "invalide"),
    ],
)
def test_un_numero_absent_invalide_ou_d_un_autre_operateur_est_refuse(
    client_http: TestClient, reference: str, corps: dict, message: str
) -> None:
    reponse = _payer(client_http, reference, corps)

    assert reponse.status_code == 422
    assert message in reponse.text


def test_une_commande_deja_payee_refuse_un_second_paiement(
    client_http: TestClient, reference: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "developpement")
    paiement = _payer(client_http, reference, MVOLA).json()
    client_http.post(
        f"{PAIEMENTS}/invite/{reference}/{paiement['id_paiement']}/simuler-confirmation"
    )

    reponse = _payer(client_http, reference, MVOLA)

    assert reponse.status_code == 409


# --- Confirmation simulée ----------------------------------------------------------


def test_la_confirmation_simulee_confirme_la_commande(
    client_http: TestClient, reference: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "developpement")
    paiement = _payer(client_http, reference, MVOLA).json()

    reponse = client_http.post(
        f"{PAIEMENTS}/invite/{reference}/{paiement['id_paiement']}/simuler-confirmation"
    )

    assert reponse.status_code == 200
    assert reponse.json()["statut"] == "Reussi"
    commande = client_http.get(f"{COMMANDES}/invite/{reference}").json()
    assert commande["statut"] == "Confirmee"


def test_le_paiement_d_une_autre_commande_repond_404(
    client_http: TestClient,
    db: Session,
    reference: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "developpement")
    paiement = _payer(client_http, reference, MVOLA).json()
    autre = client_http.post(
        f"{COMMANDES}/invite",
        json={
            "type_commande": "A_emporter",
            "nom_invite": "Autre",
            "contact_invite": "0331234567",
            "lignes": [
                {
                    "id_produit": db.get(Paiement, paiement["id_paiement"])
                    .commande.lignes[0]
                    .id_produit,
                    "quantite": 1,
                }
            ],
        },
    ).json()["reference_publique"]

    reponse = client_http.post(
        f"{PAIEMENTS}/invite/{autre}/{paiement['id_paiement']}/simuler-confirmation"
    )

    assert reponse.status_code == 404


def test_hors_developpement_la_simulation_repond_404(
    client_http: TestClient, reference: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    paiement = _payer(client_http, reference, MVOLA).json()

    reponse = client_http.post(
        f"{PAIEMENTS}/invite/{reference}/{paiement['id_paiement']}/simuler-confirmation"
    )

    assert reponse.status_code == 404


# --- Numéros -------------------------------------------------------------------------


@pytest.mark.parametrize(
    "brut",
    [
        "0341234567",
        "034 12 345 67",
        "034-12-345-67",
        "+261 34 12 345 67",
        "00261341234567",
    ],
)
def test_les_ecritures_courantes_d_un_numero_sont_normalisees(brut: str) -> None:
    assert normaliser_numero(brut) == "0341234567"


def test_la_carte_n_exige_aucun_numero() -> None:
    corps = PaiementCreate(methode="Carte", fournisseur="Stripe")

    assert corps.numero_mobile_money is None


def test_orange_et_airtel_acceptent_leurs_prefixes() -> None:
    for fournisseur, numero in [
        ("Orange_money", "0321234567"),
        ("Orange_money", "0371234567"),
        ("Airtel_money", "0331234567"),
        ("Mvola", "0381234567"),
    ]:
        PaiementCreate(
            methode="Mobile_money", fournisseur=fournisseur, numero_mobile_money=numero
        )
    with pytest.raises(ValidationError):
        PaiementCreate(
            methode="Mobile_money",
            fournisseur="Airtel_money",
            numero_mobile_money="0341234567",
        )
