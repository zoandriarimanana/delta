"""Tests HTTP du webhook de paiement, contre PostgreSQL uniquement (cf.
test_paiement_model.py).

Le point central : la **signature est vérifiée avant tout traitement** de
la charge utile, y compris avant son décodage JSON. `test_signature_verifiee_
avant_le_decodage_du_corps` en est la preuve concrète — un corps illisible
accompagné d'une signature invalide doit échouer sur la signature (401),
jamais sur la validation du corps (422), ce qui prouverait que le décodage a
eu lieu avant la vérification.
"""

import hashlib
import hmac
from collections.abc import Iterator
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, creer_jeton_acces, hacher_mot_de_passe
from app.main import app
from app.models.client import Client, TypeClient
from app.models.client_particulier import ClientParticulier
from app.models.commande import Commande, StatutCommande, TypeCommande
from app.models.paiement import (
    FournisseurPaiement,
    MethodePaiement,
    Paiement,
    StatutPaiement,
)
from app.services.passerelle_paiement_simulee import PasserelleSimulee

pytestmark = pytest.mark.postgres

WEBHOOK = f"{settings.API_V1_PREFIX}/paiements/webhook"
MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


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


def _client(db: Session, *, email: str = "p@delta.mg") -> Client:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email=email,
        mot_de_passe=MOT_DE_PASSE,
    )
    client.particulier = ClientParticulier(
        nom="Rakoto", prenom="Jean", date_naissance=date(1990, 1, 1)
    )
    db.add(client)
    db.flush()
    return client


def _commande_avec_paiement(
    db: Session, *, reference: str = "ref-webhook-1", client: Client | None = None
) -> Paiement:
    if client is None:
        client = _client(db)
    commande = Commande(
        type_commande=TypeCommande.SUR_PLACE,
        statut=StatutCommande.EN_ATTENTE,
        montant_total=Decimal("5000.00"),
        id_client=client.id_client,
    )
    db.add(commande)
    db.flush()
    paiement = Paiement(
        montant=commande.montant_total,
        methode=MethodePaiement.MOBILE_MONEY,
        fournisseur=FournisseurPaiement.MVOLA,
        statut=StatutPaiement.EN_ATTENTE,
        reference_externe=reference,
        id_commande=commande.id_commande,
    )
    db.add(paiement)
    db.commit()
    return paiement


def _jeton(client: Client) -> dict[str, str]:
    jeton = creer_jeton_acces(client.id_client, TypeSujet.CLIENT)
    return {"Authorization": f"Bearer {jeton}"}


# --- Signature, avant tout traitement ---------------------------------------


def test_webhook_sans_signature_retourne_401(
    client_http: TestClient, db: Session
) -> None:
    paiement = _commande_avec_paiement(db)

    reponse = client_http.post(
        WEBHOOK,
        json={"reference_externe": paiement.reference_externe, "statut": "Reussi"},
    )

    assert reponse.status_code == 401


def test_webhook_signature_invalide_retourne_401(
    client_http: TestClient, db: Session
) -> None:
    paiement = _commande_avec_paiement(db)

    reponse = client_http.post(
        WEBHOOK,
        json={"reference_externe": paiement.reference_externe, "statut": "Reussi"},
        headers={"X-Signature": "signature-fabriquee"},
    )

    assert reponse.status_code == 401


def test_webhook_signature_verifiee_avant_le_decodage_du_corps(
    client_http: TestClient,
) -> None:
    """Corps volontairement illisible (pas du JSON valide) : si le décodage
    avait lieu avant la vérification de signature, ce serait un 422. C'est
    un 401, la preuve que la signature est le tout premier obstacle."""
    reponse = client_http.post(
        WEBHOOK,
        content=b"ceci n'est pas du JSON",
        headers={
            "Content-Type": "application/json",
            "X-Signature": "signature-fabriquee",
        },
    )

    assert reponse.status_code == 401


def test_webhook_corps_illisible_avec_signature_valide_retourne_422(
    client_http: TestClient,
) -> None:
    """Une fois la signature reconnue, un corps qui ne respecte pas
    `WebhookPaiement` doit être rejeté normalement — la vérification de
    signature ne dispense pas de la validation du schema.

    `simuler_confirmation()` ne produit qu'un corps valide : la charge
    utile illisible est donc signée directement avec `hmac`, en dupliquant
    volontairement le mécanisme de `PasserelleSimulee._signer` plutôt que
    d'y accéder — ce test vérifie un comportement observable de l'API, pas
    un détail interne de la passerelle."""
    charge_utile = b"pas du JSON valide"
    cle = b"cle-simulee-dev-uniquement"
    signature_valide = hmac.new(cle, charge_utile, hashlib.sha256).hexdigest()

    reponse = client_http.post(
        WEBHOOK,
        content=charge_utile,
        headers={
            "Content-Type": "application/json",
            "X-Signature": signature_valide,
        },
    )

    assert reponse.status_code == 422


# --- Traitement, signature valide -------------------------------------------


def test_webhook_confirmation_reussie_fait_progresser_la_commande(
    client_http: TestClient, db: Session
) -> None:
    paiement = _commande_avec_paiement(db)
    passerelle = PasserelleSimulee()
    charge_utile, signature = passerelle.simuler_confirmation(
        paiement.reference_externe
    )

    reponse = client_http.post(
        WEBHOOK, content=charge_utile, headers={"X-Signature": signature}
    )

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["statut"] == "Reussi"

    db.refresh(paiement)
    commande = db.get(Commande, paiement.id_commande)
    assert commande is not None
    assert commande.statut == StatutCommande.CONFIRMEE


def test_webhook_reference_inconnue_retourne_422(client_http: TestClient) -> None:
    passerelle = PasserelleSimulee()
    charge_utile, signature = passerelle.simuler_confirmation("ref-inexistante")

    reponse = client_http.post(
        WEBHOOK, content=charge_utile, headers={"X-Signature": signature}
    )

    assert reponse.status_code == 422


# --- Simulation de confirmation (dev uniquement) -----------------------------


def _url_simulation(id_paiement: int) -> str:
    return f"{settings.API_V1_PREFIX}/paiements/{id_paiement}/simuler-confirmation"


def test_simuler_confirmation_fait_progresser_le_paiement_et_la_commande(
    client_http: TestClient, db: Session
) -> None:
    proprietaire = _client(db)
    paiement = _commande_avec_paiement(db, reference="ref-simu-1", client=proprietaire)

    reponse = client_http.post(
        _url_simulation(paiement.id_paiement), headers=_jeton(proprietaire)
    )

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["statut"] == "Reussi"

    db.refresh(paiement)
    commande = db.get(Commande, paiement.id_commande)
    assert commande is not None
    assert commande.statut == StatutCommande.CONFIRMEE


def test_simuler_confirmation_refuse_le_paiement_d_un_autre_client(
    client_http: TestClient, db: Session
) -> None:
    proprietaire = _client(db, email="proprietaire@delta.mg")
    autre = _client(db, email="autre@delta.mg")
    paiement = _commande_avec_paiement(db, reference="ref-simu-2", client=proprietaire)

    reponse = client_http.post(
        _url_simulation(paiement.id_paiement), headers=_jeton(autre)
    )

    assert reponse.status_code == 404


def test_simuler_confirmation_refuse_un_paiement_inconnu(
    client_http: TestClient, db: Session
) -> None:
    proprietaire = _client(db)

    reponse = client_http.post(_url_simulation(999999), headers=_jeton(proprietaire))

    assert reponse.status_code == 404


def test_simuler_confirmation_sans_jeton_retourne_401(
    client_http: TestClient, db: Session
) -> None:
    proprietaire = _client(db)
    paiement = _commande_avec_paiement(db, reference="ref-simu-3", client=proprietaire)

    reponse = client_http.post(_url_simulation(paiement.id_paiement))

    assert reponse.status_code == 401


def test_simuler_confirmation_est_idempotente(
    client_http: TestClient, db: Session
) -> None:
    """Rejoue le même chemin que le webhook (`PaiementService.confirmer`),
    qui est déjà prouvé idempotent — ce test vérifie seulement que
    l'endpoint ne casse pas en cas de double appel, pas la logique elle-même."""
    proprietaire = _client(db)
    paiement = _commande_avec_paiement(db, reference="ref-simu-4", client=proprietaire)
    entetes = _jeton(proprietaire)

    premiere = client_http.post(_url_simulation(paiement.id_paiement), headers=entetes)
    seconde = client_http.post(_url_simulation(paiement.id_paiement), headers=entetes)

    assert premiere.status_code == 200
    assert seconde.status_code == 200
    assert seconde.json()["statut"] == "Reussi"
