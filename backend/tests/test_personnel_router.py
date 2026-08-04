"""Tests HTTP des endpoints de PERSONNEL.

Montés sur l'application réelle de `app/main.py`, seule la session étant
substituée : c'est elle qui porte la traduction des erreurs métier en codes HTTP.

Point de vigilance propre à ce module : **les lectures aussi sont protégées**,
contrairement au catalogue produit. Un annuaire du personnel porte des données
personnelles de salariés, rien n'y a vocation à être lisible anonymement.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import creer_jeton_acces, hacher_mot_de_passe
from app.main import app
from app.models.client import Client, TypeClient
from app.models.personnel import Personnel
from tests.conftest import creer_engine_sqlite

PERSONNEL = f"{settings.API_V1_PREFIX}/personnel"

VALIDE = {
    "nom": "Rakoto",
    "prenom": "Jean",
    "fonction": "Livreur",
    "email": "jean@delta.mg",
}


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(Client.__table__, Personnel.__table__)
    with Session(engine) as session:
        yield session


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
def entete(db: Session) -> dict[str, str]:
    """Jeton d'un client inscrit — aucun rôle particulier.

    C'est exactement la faiblesse actée : rien ne distingue ce client d'un
    administrateur. #23 remplace cette barrière.
    """
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email="client@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(client)
    db.commit()
    return {"Authorization": f"Bearer {creer_jeton_acces(client.id_client)}"}


def _creer(client_http: TestClient, entete: dict[str, str], **extra: object) -> dict:
    reponse = client_http.post(PERSONNEL, json={**VALIDE, **extra}, headers=entete)
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


# --- Authentification ---------------------------------------------------------


@pytest.mark.parametrize(
    ("methode", "chemin"),
    [
        ("get", ""),
        ("get", "/1"),
        ("post", ""),
        ("put", "/1"),
        ("delete", "/1"),
        ("post", "/1/restauration"),
    ],
)
def test_tout_endpoint_exige_un_jeton(
    client_http: TestClient, methode: str, chemin: str
) -> None:
    """Y compris les lectures — c'est la différence avec le catalogue."""
    # `request` et non `client_http.get(...)` : les raccourcis `get` et `delete`
    # de TestClient n'acceptent pas de corps, alors que le refus doit être
    # vérifié avec la même charge utile pour tous les verbes.
    reponse = client_http.request(methode.upper(), f"{PERSONNEL}{chemin}", json=VALIDE)

    assert reponse.status_code == 401


def test_jeton_invalide_refuse(client_http: TestClient) -> None:
    reponse = client_http.get(
        PERSONNEL, headers={"Authorization": "Bearer pas.un.jeton"}
    )

    assert reponse.status_code == 401


# --- Création -----------------------------------------------------------------


def test_creation(client_http: TestClient, entete: dict[str, str]) -> None:
    corps = _creer(client_http, entete)

    assert corps["fonction"] == "Livreur"
    assert corps["est_administrateur"] is False


@pytest.mark.parametrize(
    "fonction", ["Formateur", "Livreur", "Cuisinier", "Receptionniste", "Autre"]
)
def test_toutes_les_fonctions_acceptees(
    client_http: TestClient, entete: dict[str, str], fonction: str
) -> None:
    corps = _creer(
        client_http, entete, fonction=fonction, email=f"{fonction.lower()}@delta.mg"
    )

    assert corps["fonction"] == fonction


@pytest.mark.parametrize("fonction", ["Plombier", "livreur", "LIVREUR", ""])
def test_fonction_hors_domaine_donne_422(
    client_http: TestClient, entete: dict[str, str], fonction: str
) -> None:
    reponse = client_http.post(
        PERSONNEL, json={**VALIDE, "fonction": fonction}, headers=entete
    )

    assert reponse.status_code == 422


def test_email_invalide_donne_422(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    reponse = client_http.post(
        PERSONNEL, json={**VALIDE, "email": "pas-une-adresse"}, headers=entete
    )

    assert reponse.status_code == 422


def test_email_deja_pris_donne_409(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    _creer(client_http, entete)

    reponse = client_http.post(PERSONNEL, json=VALIDE, headers=entete)

    assert reponse.status_code == 409
    assert "SELECT" not in reponse.json()["detail"]


# --- Lecture ------------------------------------------------------------------


def test_lister(client_http: TestClient, entete: dict[str, str]) -> None:
    _creer(client_http, entete)
    _creer(client_http, entete, email="marie@delta.mg", fonction="Cuisinier")

    reponse = client_http.get(PERSONNEL, headers=entete)

    assert reponse.status_code == 200
    assert len(reponse.json()) == 2


def test_filtre_par_fonction(client_http: TestClient, entete: dict[str, str]) -> None:
    _creer(client_http, entete)
    _creer(client_http, entete, email="marie@delta.mg", fonction="Cuisinier")

    reponse = client_http.get(
        PERSONNEL, params={"fonction": "Cuisinier"}, headers=entete
    )

    assert [p["email"] for p in reponse.json()] == ["marie@delta.mg"]


def test_filtre_hors_domaine_donne_422(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    reponse = client_http.get(
        PERSONNEL, params={"fonction": "Plombier"}, headers=entete
    )

    assert reponse.status_code == 422


def test_filtre_sans_titulaire_donne_une_liste_vide(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    """Critère de recherche, pas ressource désignée : liste vide, pas 404."""
    _creer(client_http, entete)

    reponse = client_http.get(PERSONNEL, params={"fonction": "Autre"}, headers=entete)

    assert reponse.status_code == 200
    assert reponse.json() == []


def test_obtenir_inconnu_donne_404(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    assert client_http.get(f"{PERSONNEL}/99999", headers=entete).status_code == 404


# --- Modification -------------------------------------------------------------


def test_modification_partielle(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    cree = _creer(client_http, entete, specialite="Pâtisserie")

    reponse = client_http.put(
        f"{PERSONNEL}/{cree['id_personnel']}", json={"nom": "Rabe"}, headers=entete
    )

    assert reponse.status_code == 200
    assert reponse.json()["nom"] == "Rabe"
    assert reponse.json()["specialite"] == "Pâtisserie"


def test_modifier_inconnu_donne_404(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    reponse = client_http.put(
        f"{PERSONNEL}/99999", json={"nom": "Rabe"}, headers=entete
    )

    assert reponse.status_code == 404


# --- Archivage et restauration ------------------------------------------------


def test_suppression_puis_invisibilite(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    cree = _creer(client_http, entete)

    assert (
        client_http.delete(
            f"{PERSONNEL}/{cree['id_personnel']}", headers=entete
        ).status_code
        == 204
    )
    assert (
        client_http.get(
            f"{PERSONNEL}/{cree['id_personnel']}", headers=entete
        ).status_code
        == 404
    )


def test_restauration(client_http: TestClient, entete: dict[str, str]) -> None:
    cree = _creer(client_http, entete)
    client_http.delete(f"{PERSONNEL}/{cree['id_personnel']}", headers=entete)

    reponse = client_http.post(
        f"{PERSONNEL}/{cree['id_personnel']}/restauration", headers=entete
    )

    assert reponse.status_code == 200
    assert (
        client_http.get(
            f"{PERSONNEL}/{cree['id_personnel']}", headers=entete
        ).status_code
        == 200
    )


def test_restauration_refusee_si_adresse_reprise(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    cree = _creer(client_http, entete)
    client_http.delete(f"{PERSONNEL}/{cree['id_personnel']}", headers=entete)
    _creer(client_http, entete)

    reponse = client_http.post(
        f"{PERSONNEL}/{cree['id_personnel']}/restauration", headers=entete
    )

    assert reponse.status_code == 409
