"""Tests HTTP des endpoints de LIVRAISON, contre PostgreSQL uniquement.

Deux points de vigilance.

Les endpoints de `/livraisons` exigent tous un jeton de **personnel** : une
livraison porte l'adresse d'un client et l'identité d'un salarié.

Le suivi côté client passe par un chemin distinct, qui répond avec
`LivraisonPublique` — statut et dates, jamais le livreur. C'est ce que vérifie
`test_le_suivi_public_ne_divulgue_pas_le_livreur`, le test le plus important du
module : l'URL invitée n'a aucune authentification, un UUID suffit à l'ouvrir.
"""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, creer_jeton_acces, hacher_mot_de_passe
from app.main import app
from app.models.categorie_produit import CategorieProduit
from app.models.client import Client, TypeClient
from app.models.personnel import FonctionPersonnel, Personnel
from app.models.produit import Produit

pytestmark = pytest.mark.postgres

COMMANDES = f"{settings.API_V1_PREFIX}/commandes"
LIVRAISONS = f"{settings.API_V1_PREFIX}/livraisons"
ADRESSE = "Lot II M 45 Antananarivo"
MDP = "motdepasse123"


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def client_http(db: Session) -> Iterator[TestClient]:
    """Application réelle, seule la session étant substituée.

    C'est elle qui porte la traduction des erreurs métier en codes HTTP par les
    gestionnaires globaux de `main.py`.
    """

    def _get_db() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as testeur:
            yield testeur
    finally:
        # `app` est un singleton de module : sans nettoyage, la substitution
        # fuiterait sur les tests suivants.
        app.dependency_overrides.clear()


def _entete_personnel(
    db: Session, fonction: FonctionPersonnel, *, administrateur: bool
) -> dict[str, str]:
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=fonction,
        email=f"agent_{uuid4().hex[:8]}@delta.mg",
        est_administrateur=administrateur,
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(agent)
    db.commit()
    jeton = creer_jeton_acces(agent.id_personnel, TypeSujet.PERSONNEL)
    return {"Authorization": f"Bearer {jeton}"}


@pytest.fixture
def entete_admin(db: Session) -> dict[str, str]:
    return _entete_personnel(db, FonctionPersonnel.AUTRE, administrateur=True)


@pytest.fixture
def entete_agent(db: Session) -> dict[str, str]:
    return _entete_personnel(db, FonctionPersonnel.CUISINIER, administrateur=False)


@pytest.fixture
def livreur(db: Session) -> Personnel:
    personnel = Personnel(
        nom="Rabe",
        prenom="Paul",
        fonction=FonctionPersonnel.LIVREUR,
        email=f"livreur_{uuid4().hex[:8]}@delta.mg",
        telephone="+261340000000",
    )
    db.add(personnel)
    db.commit()
    return personnel


@pytest.fixture
def compte(db: Session) -> Client:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"jean_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(client)
    db.commit()
    return client


@pytest.fixture
def entete_client(compte: Client) -> dict[str, str]:
    jeton = creer_jeton_acces(compte.id_client, TypeSujet.CLIENT)
    return {"Authorization": f"Bearer {jeton}"}


@pytest.fixture
def eclair(db: Session) -> Produit:
    categorie = CategorieProduit(libelle=f"Cat {uuid4().hex[:6]}")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Éclair",
        prix_unitaire=Decimal("3.50"),
        unite_mesure="piece",
        stock_disponible=100,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def _corps(id_produit: int, adresse: str | None = ADRESSE) -> dict:
    return {
        "type_commande": "En_ligne",
        "adresse_livraison": adresse,
        "lignes": [{"id_produit": id_produit, "quantite": 1}],
    }


@pytest.fixture
def commande(
    client_http: TestClient, entete_client: dict[str, str], eclair: Produit
) -> dict:
    reponse = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit), headers=entete_client
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


@pytest.fixture
def id_livraison(
    client_http: TestClient, entete_admin: dict[str, str], commande: dict
) -> int:
    reponse = client_http.get(LIVRAISONS, headers=entete_admin)
    assert reponse.status_code == 200
    for item in reponse.json():
        if item["id_commande"] == commande["id_commande"]:
            return item["id_livraison"]
    raise AssertionError("aucune livraison créée pour cette commande")


# --- Accès --------------------------------------------------------------------


def test_sans_jeton_aucune_lecture(client_http: TestClient) -> None:
    assert client_http.get(LIVRAISONS).status_code == 401


def test_un_jeton_client_n_ouvre_rien(
    client_http: TestClient, entete_client: dict[str, str]
) -> None:
    """Une livraison porte l'adresse d'un client et l'identité d'un salarié."""
    assert client_http.get(LIVRAISONS, headers=entete_client).status_code == 401


def test_un_salarie_peut_consulter(
    client_http: TestClient, entete_agent: dict[str, str], id_livraison: int
) -> None:
    reponse = client_http.get(f"{LIVRAISONS}/{id_livraison}", headers=entete_agent)

    assert reponse.status_code == 200


def test_un_salarie_ne_peut_pas_affecter(
    client_http: TestClient,
    entete_agent: dict[str, str],
    id_livraison: int,
    livreur: Personnel,
) -> None:
    """Affecter relève de la gestion, pas du travail quotidien."""
    reponse = client_http.put(
        f"{LIVRAISONS}/{id_livraison}/livreur",
        json={"id_personnel": livreur.id_personnel},
        headers=entete_agent,
    )

    assert reponse.status_code == 403


def test_un_salarie_peut_faire_avancer_la_tournee(
    client_http: TestClient,
    entete_agent: dict[str, str],
    entete_admin: dict[str, str],
    id_livraison: int,
    livreur: Personnel,
) -> None:
    """C'est le livreur lui-même qui déclare son avancement."""
    client_http.put(
        f"{LIVRAISONS}/{id_livraison}/livreur",
        json={"id_personnel": livreur.id_personnel},
        headers=entete_admin,
    )

    reponse = client_http.put(
        f"{LIVRAISONS}/{id_livraison}/statut",
        json={"statut": "En_cours"},
        headers=entete_agent,
    )

    assert reponse.status_code == 200


# --- Affectation --------------------------------------------------------------


def test_affecter_un_non_livreur_retourne_422(
    client_http: TestClient,
    entete_admin: dict[str, str],
    id_livraison: int,
    db: Session,
) -> None:
    """Rien en base ne l'empêche : c'est le service qui refuse."""
    cuisinier = Personnel(
        nom="Rasoa",
        prenom="Marie",
        fonction=FonctionPersonnel.CUISINIER,
        email=f"cuisine_{uuid4().hex[:8]}@delta.mg",
    )
    db.add(cuisinier)
    db.commit()

    reponse = client_http.put(
        f"{LIVRAISONS}/{id_livraison}/livreur",
        json={"id_personnel": cuisinier.id_personnel},
        headers=entete_admin,
    )

    assert reponse.status_code == 422
    assert "Cuisinier" in reponse.json()["detail"]


def test_affecter_un_inconnu_retourne_422(
    client_http: TestClient, entete_admin: dict[str, str], id_livraison: int
) -> None:
    reponse = client_http.put(
        f"{LIVRAISONS}/{id_livraison}/livreur",
        json={"id_personnel": 99999},
        headers=entete_admin,
    )

    assert reponse.status_code == 422


def test_livraison_terminee_retourne_409(
    client_http: TestClient,
    entete_admin: dict[str, str],
    id_livraison: int,
    livreur: Personnel,
) -> None:
    """409 et non 422 : la charge utile est valide, c'est l'état qui interdit."""
    client_http.put(
        f"{LIVRAISONS}/{id_livraison}/statut",
        json={"statut": "Annulee"},
        headers=entete_admin,
    )

    reponse = client_http.put(
        f"{LIVRAISONS}/{id_livraison}/livreur",
        json={"id_personnel": livreur.id_personnel},
        headers=entete_admin,
    )

    assert reponse.status_code == 409


def test_planification(
    client_http: TestClient, entete_admin: dict[str, str], id_livraison: int
) -> None:
    prevue = (datetime.now(UTC) + timedelta(hours=3)).isoformat()

    reponse = client_http.put(
        f"{LIVRAISONS}/{id_livraison}/planification",
        json={"date_heure_prevue": prevue},
        headers=entete_admin,
    )

    assert reponse.status_code == 200
    assert reponse.json()["date_heure_prevue"] is not None


# --- Suivi côté client --------------------------------------------------------


def test_le_suivi_public_ne_divulgue_pas_le_livreur(
    client_http: TestClient,
    entete_admin: dict[str, str],
    entete_client: dict[str, str],
    commande: dict,
    id_livraison: int,
    livreur: Personnel,
) -> None:
    """Le test le plus important du module.

    L'identité et le contact du livreur sont des données personnelles d'un tiers.
    Le schema de sortie porte cette garantie, pas un filtrage à l'affichage.
    """
    client_http.put(
        f"{LIVRAISONS}/{id_livraison}/livreur",
        json={"id_personnel": livreur.id_personnel},
        headers=entete_admin,
    )

    reponse = client_http.get(
        f"{COMMANDES}/{commande['id_commande']}/livraison", headers=entete_client
    )

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["statut"] == "En_attente"
    for interdit in ("id_personnel", "livreur", "adresse_livraison"):
        assert interdit not in corps
    brut = reponse.text
    assert livreur.nom not in brut
    assert livreur.telephone is not None
    assert livreur.telephone not in brut


def test_le_suivi_invite_ne_divulgue_pas_le_livreur(
    client_http: TestClient,
    entete_admin: dict[str, str],
    eclair: Produit,
    livreur: Personnel,
) -> None:
    """Même garantie sur l'URL publique, qui n'a aucune authentification."""
    creee = client_http.post(
        f"{COMMANDES}/invite",
        json={
            **_corps(eclair.id_produit),
            "type_commande": "A_emporter",
            "nom_invite": "Rakoto Jean",
            "contact_invite": "+261340000001",
        },
    ).json()
    livraisons = client_http.get(LIVRAISONS, headers=entete_admin).json()
    identifiant = next(
        item["id_livraison"]
        for item in livraisons
        if item["id_commande"] == creee["id_commande"]
    )
    client_http.put(
        f"{LIVRAISONS}/{identifiant}/livreur",
        json={"id_personnel": livreur.id_personnel},
        headers=entete_admin,
    )

    reponse = client_http.get(
        f"{COMMANDES}/invite/{creee['reference_publique']}/livraison"
    )

    assert reponse.status_code == 200
    assert reponse.json()["statut"] == "En_attente"
    assert livreur.nom not in reponse.text


def test_le_suivi_d_autrui_retourne_404(
    client_http: TestClient, commande: dict, db: Session
) -> None:
    """404 et non 403 : confirmer l'existence renseignerait déjà."""
    autre = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"autre_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(autre)
    db.commit()
    jeton = creer_jeton_acces(autre.id_client, TypeSujet.CLIENT)

    reponse = client_http.get(
        f"{COMMANDES}/{commande['id_commande']}/livraison",
        headers={"Authorization": f"Bearer {jeton}"},
    )

    assert reponse.status_code == 404


def test_commande_sans_livraison_retourne_404(
    client_http: TestClient,
    entete_client: dict[str, str],
    eclair: Produit,
) -> None:
    """Une commande à retirer n'a pas de livraison à montrer."""
    creee = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit, adresse=None), headers=entete_client
    ).json()

    reponse = client_http.get(
        f"{COMMANDES}/{creee['id_commande']}/livraison", headers=entete_client
    )

    assert reponse.status_code == 404


# --- Création automatique par la commande -------------------------------------


def test_commande_sur_place_avec_adresse_retourne_422(
    client_http: TestClient, entete_client: dict[str, str], eclair: Produit
) -> None:
    corps = {**_corps(eclair.id_produit), "type_commande": "Sur_place"}

    reponse = client_http.post(COMMANDES, json=corps, headers=entete_client)

    assert reponse.status_code == 422


def test_produit_non_livrable_avec_adresse_retourne_422(
    client_http: TestClient,
    entete_client: dict[str, str],
    eclair: Produit,
    db: Session,
) -> None:
    eclair.est_livrable = False
    db.commit()

    reponse = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit), headers=entete_client
    )

    assert reponse.status_code == 422
