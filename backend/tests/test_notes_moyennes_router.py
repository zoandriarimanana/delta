"""Tests HTTP de l'agrégation de note moyenne (8.3) sur les fiches PRODUIT,
SALLE, LOGEMENT et FORMATION.

Fichier dédié, distinct des suites de chaque entité : ce comportement
traverse quatre routers et une seule entité source (`AVIS`), pas une
extension propre à l'un d'eux — même raisonnement que les fichiers
`test_avis_*.py` séparés par couche.

Contre PostgreSQL uniquement : `RESERVATION` porte des contraintes
d'exclusion `EXCLUDE USING gist` que SQLite ne sait pas créer, et les
fixtures de ce fichier en créent (`test_formation_router.py`, lui, n'y touche
jamais et reste sur SQLite).
"""

from datetime import date
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hacher_mot_de_passe
from app.main import app
from app.models.avis import Avis, TypeAvis
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.client_particulier import ClientParticulier
from app.models.commande import Commande, StatutCommande, TypeCommande
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.ligne_commande import LigneCommande
from app.models.logement import Logement, StatutLogement
from app.models.produit import Produit
from app.models.reservation import Reservation, StatutReservation, TypeReservation
from app.models.salle import Salle
from app.models.session_formation import SessionFormation, StatutSessionFormation

pytestmark = pytest.mark.postgres

PRODUITS = f"{settings.API_V1_PREFIX}/produits"
SALLES = f"{settings.API_V1_PREFIX}/salles"
LOGEMENTS = f"{settings.API_V1_PREFIX}/logements"
FORMATIONS = f"{settings.API_V1_PREFIX}/formations"
MOT_DE_PASSE = hacher_mot_de_passe("mot-de-passe")


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def client_http(db: Session):
    def _get_db():
        yield db

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as testeur:
            yield testeur
    finally:
        app.dependency_overrides.clear()


def _client(db: Session) -> Client:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"{uuid4().hex[:8]}@delta.mg",
        mot_de_passe=MOT_DE_PASSE,
    )
    client.particulier = ClientParticulier(
        nom="Rakoto", prenom="Jean", date_naissance=date(1990, 1, 1)
    )
    db.add(client)
    db.flush()
    return client


def _produit(db: Session) -> Produit:
    categorie = CategorieProduit(libelle=f"Cat-{uuid4().hex[:8]}")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Baguette",
        description="desc",
        prix_unitaire=1000,
        unite_mesure="unite",
        stock_disponible=10,
        est_personnalisable=False,
        est_livrable=True,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def _note_produit(db: Session, produit: Produit, note: int) -> None:
    client = _client(db)
    commande = Commande(
        type_commande=TypeCommande.SUR_PLACE,
        statut=StatutCommande.SERVIE,
        montant_total=1000,
        id_client=client.id_client,
    )
    db.add(commande)
    db.flush()
    ligne = LigneCommande(
        quantite=1,
        prix_unitaire_applique=1000,
        id_commande=commande.id_commande,
        id_produit=produit.id_produit,
    )
    db.add(ligne)
    db.flush()
    db.add(
        Avis(
            type_avis=TypeAvis.PRODUIT,
            note=note,
            id_client=client.id_client,
            id_ligne=ligne.id_ligne,
        )
    )
    db.commit()


def _note_service(db: Session, note: int, **cible: object) -> None:
    client = _client(db)
    donnees: dict[str, object] = {
        "date_debut": date(2026, 1, 1),
        "date_fin": date(2026, 1, 1),
        "nombre_personnes": 2,
        "statut": StatutReservation.HONOREE,
        "avec_hebergement": False,
        "id_client": client.id_client,
    }
    if "id_salle" in cible:
        donnees["type_reservation"] = TypeReservation.SALLE
    elif "id_logement" in cible:
        donnees["type_reservation"] = TypeReservation.LOGEMENT
    else:
        donnees["type_reservation"] = TypeReservation.FORMATION
    donnees.update(cible)
    reservation = Reservation(**donnees)
    db.add(reservation)
    db.flush()
    db.add(
        Avis(
            type_avis=TypeAvis.SERVICE,
            note=note,
            id_client=client.id_client,
            id_reservation=reservation.id_reservation,
        )
    )
    db.commit()


def _salle(db: Session) -> Salle:
    salle = Salle(nom=f"Salle-{uuid4().hex[:8]}", capacite=10, tarif_horaire=1000)
    db.add(salle)
    db.commit()
    return salle


def _logement(db: Session) -> Logement:
    logement = Logement(
        type_chambre="Simple",
        capacite=2,
        tarif_nuitee=1000,
        statut=StatutLogement.DISPONIBLE,
    )
    db.add(logement)
    db.commit()
    return logement


def _formation(db: Session) -> tuple[Formation, SessionFormation]:
    domaine = DomaineFormation(libelle=f"Domaine-{uuid4().hex[:8]}")
    db.add(domaine)
    db.flush()
    formation = Formation(
        titre="Pâtisserie",
        duree_heures=10,
        prix=1000,
        capacite_max=10,
        propose_hebergement=False,
        id_domaine=domaine.id_domaine,
    )
    db.add(formation)
    db.flush()
    session = SessionFormation(
        date_debut=date(2026, 1, 1),
        date_fin=date(2026, 1, 2),
        places_restantes=10,
        statut=StatutSessionFormation.OUVERTE,
        id_formation=formation.id_formation,
    )
    db.add(session)
    db.commit()
    return formation, session


# --- Produit -----------------------------------------------------------------


def test_fiche_produit_sans_avis_expose_note_moyenne_nulle(
    client_http: TestClient, db: Session
) -> None:
    produit = _produit(db)

    reponse = client_http.get(f"{PRODUITS}/{produit.id_produit}")

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["note_moyenne"] is None
    assert corps["nombre_avis"] == 0


def test_fiche_produit_avec_avis_expose_la_moyenne(
    client_http: TestClient, db: Session
) -> None:
    produit = _produit(db)
    _note_produit(db, produit, 5)
    _note_produit(db, produit, 3)

    reponse = client_http.get(f"{PRODUITS}/{produit.id_produit}")

    corps = reponse.json()
    assert float(corps["note_moyenne"]) == 4.0
    assert corps["nombre_avis"] == 2


def test_liste_produits_n_expose_pas_la_moyenne_reelle(
    client_http: TestClient, db: Session
) -> None:
    """Portée fiche uniquement (décision Sprint 8) : la liste, non paginée,
    ne calcule pas l'agrégation — les champs restent à leur défaut."""
    produit = _produit(db)
    _note_produit(db, produit, 5)

    reponse = client_http.get(PRODUITS)

    corps = next(p for p in reponse.json() if p["id_produit"] == produit.id_produit)
    assert corps["note_moyenne"] is None
    assert corps["nombre_avis"] == 0


# --- Salle ---------------------------------------------------------------


def test_fiche_salle_expose_la_moyenne(client_http: TestClient, db: Session) -> None:
    salle = _salle(db)
    _note_service(db, 4, id_salle=salle.id_salle)
    _note_service(db, 2, id_salle=salle.id_salle)

    reponse = client_http.get(f"{SALLES}/{salle.id_salle}")

    corps = reponse.json()
    assert float(corps["note_moyenne"]) == 3.0
    assert corps["nombre_avis"] == 2


def test_liste_salles_n_expose_pas_la_moyenne_reelle(
    client_http: TestClient, db: Session
) -> None:
    salle = _salle(db)
    _note_service(db, 5, id_salle=salle.id_salle)

    reponse = client_http.get(SALLES)

    corps = next(s for s in reponse.json() if s["id_salle"] == salle.id_salle)
    assert corps["note_moyenne"] is None
    assert corps["nombre_avis"] == 0


# --- Logement --------------------------------------------------------------


def test_fiche_logement_expose_la_moyenne(client_http: TestClient, db: Session) -> None:
    logement = _logement(db)
    _note_service(db, 5, id_logement=logement.id_logement)

    reponse = client_http.get(f"{LOGEMENTS}/{logement.id_logement}")

    corps = reponse.json()
    assert float(corps["note_moyenne"]) == 5.0
    assert corps["nombre_avis"] == 1


# --- Formation ---------------------------------------------------------------


def test_fiche_formation_agrege_toutes_les_sessions(
    client_http: TestClient, db: Session
) -> None:
    formation, session_1 = _formation(db)
    _, session_2 = (
        formation,
        SessionFormation(
            date_debut=date(2026, 2, 1),
            date_fin=date(2026, 2, 2),
            places_restantes=10,
            statut=StatutSessionFormation.OUVERTE,
            id_formation=formation.id_formation,
        ),
    )
    db.add(session_2)
    db.commit()
    _note_service(db, 5, id_session=session_1.id_session)
    _note_service(db, 1, id_session=session_2.id_session)

    reponse = client_http.get(f"{FORMATIONS}/{formation.id_formation}")

    corps = reponse.json()
    assert float(corps["note_moyenne"]) == 3.0
    assert corps["nombre_avis"] == 2


def test_liste_formations_n_expose_pas_la_moyenne_reelle(
    client_http: TestClient, db: Session
) -> None:
    formation, session = _formation(db)
    _note_service(db, 5, id_session=session.id_session)

    reponse = client_http.get(FORMATIONS)

    corps = next(
        f for f in reponse.json() if f["id_formation"] == formation.id_formation
    )
    assert corps["note_moyenne"] is None
    assert corps["nombre_avis"] == 0
