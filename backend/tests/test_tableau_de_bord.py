"""Tableau de bord de l'administration (14 octobre 2026).

La base de test peut porter d'autres commandes : les totaux se vérifient par
**différence** avant / après, et le classement sur des produits créés ici.
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
from app.models.commande import Commande, StatutCommande
from app.models.produit import Produit
from app.schemas.tableau_de_bord import Periode
from app.services.tableau_de_bord_service import TableauDeBordService
from tests.test_reservation_router import _entete_admin, _entete_agent

pytestmark = pytest.mark.postgres

COMMANDES = f"{settings.API_V1_PREFIX}/commandes"
TABLEAU = f"{settings.API_V1_PREFIX}/tableau-de-bord"


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


def _produit(db: Session, nom: str, prix: str, **extra: object) -> Produit:
    categorie = CategorieProduit(libelle=f"Cat {uuid4().hex[:6]}")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom=f"{nom} {uuid4().hex[:6]}",
        prix_unitaire=Decimal(prix),
        unite_mesure="piece",
        stock_disponible=100,
        id_categorie=categorie.id_categorie,
        **extra,
    )
    db.add(produit)
    db.commit()
    return produit


def _vendre(
    client_http: TestClient,
    db: Session,
    produit: Produit,
    quantite: int,
    statut: StatutCommande = StatutCommande.CONFIRMEE,
    il_y_a: timedelta | None = None,
) -> int:
    """Une commande invitée d'une ligne, passée au `statut` voulu."""
    reponse = client_http.post(
        f"{COMMANDES}/invite",
        json={
            "type_commande": "A_emporter",
            "nom_invite": "Rasoa",
            "contact_invite": "0341234567",
            "lignes": [{"id_produit": produit.id_produit, "quantite": quantite}],
        },
    )
    assert reponse.status_code == 201, reponse.text
    id_commande = reponse.json()["id_commande"]
    valeurs: dict[str, object] = {"statut": statut}
    if il_y_a is not None:
        valeurs["date_commande"] = datetime.now(UTC) - il_y_a
    db.execute(
        update(Commande).where(Commande.id_commande == id_commande).values(**valeurs)
    )
    db.commit()
    return id_commande


def _ventes(db: Session, periode: Periode = Periode.TRENTE_JOURS) -> dict[int, dict]:
    tableau = TableauDeBordService(db).calculer(periode)
    return {p.id_produit: p.model_dump() for p in tableau.produits}


def test_classe_les_produits_par_quantite_avec_leur_chiffre(
    client_http: TestClient, db: Session
) -> None:
    eclair = _produit(db, "Éclair", "3500.00")
    pain = _produit(db, "Pain", "2500.00")
    _vendre(client_http, db, eclair, 2)
    _vendre(client_http, db, eclair, 3)
    _vendre(client_http, db, pain, 1)

    tableau = TableauDeBordService(db).calculer(Periode.TRENTE_JOURS)
    ventes = {p.id_produit: p for p in tableau.produits}

    assert ventes[eclair.id_produit].unites_vendues == 5
    assert ventes[eclair.id_produit].chiffre_affaires == Decimal("17500.00")
    assert ventes[eclair.id_produit].nombre_commandes == 2
    assert ventes[pain.id_produit].unites_vendues == 1
    ordre = [p.id_produit for p in tableau.produits]
    assert ordre.index(eclair.id_produit) < ordre.index(pain.id_produit)


def test_ne_compte_ni_les_commandes_en_attente_ni_les_annulees(
    client_http: TestClient, db: Session
) -> None:
    produit = _produit(db, "Tarte", "4000.00")
    avant = TableauDeBordService(db).calculer(Periode.TOUT)
    _vendre(client_http, db, produit, 1, StatutCommande.EN_ATTENTE)
    _vendre(client_http, db, produit, 1, StatutCommande.ANNULEE)
    _vendre(client_http, db, produit, 2, StatutCommande.SERVIE)

    apres = TableauDeBordService(db).calculer(Periode.TOUT)

    assert _ventes(db, Periode.TOUT)[produit.id_produit]["unites_vendues"] == 2
    assert apres.nombre_commandes - avant.nombre_commandes == 1
    assert apres.chiffre_affaires - avant.chiffre_affaires == Decimal("8000.00")
    assert apres.commandes_a_confirmer - avant.commandes_a_confirmer == 1


def test_une_vente_hors_periode_n_est_pas_comptee(
    client_http: TestClient, db: Session
) -> None:
    produit = _produit(db, "Brioche", "1500.00")
    _vendre(client_http, db, produit, 4, il_y_a=timedelta(days=40))
    _vendre(client_http, db, produit, 1)

    assert _ventes(db, Periode.TRENTE_JOURS)[produit.id_produit]["unites_vendues"] == 1
    assert _ventes(db, Periode.DOUZE_MOIS)[produit.id_produit]["unites_vendues"] == 5


def test_une_commande_archivee_reste_une_vente(
    client_http: TestClient, db: Session
) -> None:
    produit = _produit(db, "Croissant", "1000.00")
    id_commande = _vendre(client_http, db, produit, 3, StatutCommande.LIVREE)
    archivage = client_http.delete(
        f"{COMMANDES}/administration/{id_commande}", headers=_entete_admin(db)
    )
    assert archivage.status_code == 204

    assert _ventes(db)[produit.id_produit]["unites_vendues"] == 3


def test_un_produit_vendu_a_la_personne_compte_un_produit_par_ligne(
    client_http: TestClient, db: Session
) -> None:
    gateau = _produit(db, "Gâteau", "5000.00", vendu_par_personne=True, personnes_min=4)
    _vendre(client_http, db, gateau, 6)

    vente = _ventes(db)[gateau.id_produit]
    assert vente["unites_vendues"] == 1
    assert vente["chiffre_affaires"] == Decimal("30000.00")


def test_route_reservee_a_l_administration(
    client_http: TestClient, db: Session
) -> None:
    ok = client_http.get(f"{TABLEAU}?periode=7j", headers=_entete_admin(db))
    refuse = client_http.get(TABLEAU, headers=_entete_agent(db))
    anonyme = client_http.get(TABLEAU)

    assert ok.status_code == 200
    assert ok.json()["periode"] == "7j"
    assert {"chiffre_affaires", "panier_moyen", "produits"} <= ok.json().keys()
    assert refuse.status_code == 403
    assert anonyme.status_code == 401
