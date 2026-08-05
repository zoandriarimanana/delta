"""Tests HTTP des endpoints de PERSONNEL.

Montés sur l'application réelle de `app/main.py`, seule la session étant
substituée : c'est elle qui porte la traduction des erreurs métier en codes HTTP.

Point de vigilance propre à ce module : **les lectures aussi sont protégées**,
contrairement au catalogue produit. Un annuaire du personnel porte des données
personnelles de salariés, rien n'y a vocation à être lisible anonymement.

Deux niveaux depuis #23 : lecture par tout salarié authentifié, écriture par les
seuls administrateurs. Un jeton client n'ouvre plus rien ici.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, creer_jeton_acces, hacher_mot_de_passe
from app.main import app
from app.models.client import Client, TypeClient
from app.models.personnel import FonctionPersonnel, Personnel
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


def _jeton_personnel(
    db: Session, email: str, *, administrateur: bool
) -> dict[str, str]:
    """Forge un membre du personnel connectable et retourne son en-tête."""
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=email,
        est_administrateur=administrateur,
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(agent)
    db.commit()
    jeton = creer_jeton_acces(agent.id_personnel, TypeSujet.PERSONNEL)
    return {"Authorization": f"Bearer {jeton}"}


@pytest.fixture
def entete(db: Session) -> dict[str, str]:
    """Jeton d'un administrateur : les écritures de l'annuaire lui sont réservées."""
    return _jeton_personnel(db, "admin@delta.mg", administrateur=True)


@pytest.fixture
def entete_agent(db: Session) -> dict[str, str]:
    """Jeton d'un salarié sans droit d'administration : lecture seule."""
    return _jeton_personnel(db, "agent@delta.mg", administrateur=False)


@pytest.fixture
def entete_client(db: Session) -> dict[str, str]:
    """Jeton d'un client : ne doit ouvrir aucun endpoint de l'annuaire."""
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email="client@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(client)
    db.commit()
    jeton = creer_jeton_acces(client.id_client, TypeSujet.CLIENT)
    return {"Authorization": f"Bearer {jeton}"}


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
    """L'administrateur qui appelle figure lui-même dans l'annuaire.

    Ce n'est pas un artefact de test : la fixture crée un vrai salarié, et
    l'annuaire n'a aucune raison de masquer l'appelant. On compte donc les deux
    créations **plus** lui.
    """
    _creer(client_http, entete)
    _creer(client_http, entete, email="marie@delta.mg", fonction="Cuisinier")

    reponse = client_http.get(PERSONNEL, headers=entete)

    assert reponse.status_code == 200
    emails = {p["email"] for p in reponse.json()}
    assert {"jean@delta.mg", "marie@delta.mg", "admin@delta.mg"} == emails


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
    """Critère de recherche, pas ressource désignée : liste vide, pas 404.

    Le filtre porte sur `Receptionniste` : ni le livreur créé ici, ni
    l'administrateur de la fixture — qui exerce `Autre` — n'y répondent.
    """
    _creer(client_http, entete)

    reponse = client_http.get(
        PERSONNEL, params={"fonction": "Receptionniste"}, headers=entete
    )

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


# --- Élévation de privilège ---------------------------------------------------


def test_creation_ignore_est_administrateur_force_dans_le_corps(
    client_http: TestClient, entete: dict[str, str], db: Session
) -> None:
    """Le cœur de la protection : le champ est absent du schema, pas seulement
    absent des exemples.

    Pydantic ignore silencieusement les clés inconnues : la requête est donc
    acceptée en 201. Ce qu'on vérifie, c'est que la valeur n'a atteint ni la
    réponse ni la base. Sans ce test, la protection tiendrait à un comportement
    par défaut de Pydantic que rien ne documente ici.
    """
    reponse = client_http.post(
        PERSONNEL, json={**VALIDE, "est_administrateur": True}, headers=entete
    )

    assert reponse.status_code == 201
    assert reponse.json()["est_administrateur"] is False

    en_base = db.get(Personnel, reponse.json()["id_personnel"])
    assert en_base is not None
    assert en_base.est_administrateur is False


def test_modification_ne_peut_pas_promouvoir_administrateur(
    client_http: TestClient, entete: dict[str, str], db: Session
) -> None:
    """La modification ne doit pas être une porte dérobée vers ce que la
    création interdit."""
    cree = _creer(client_http, entete)

    reponse = client_http.put(
        f"{PERSONNEL}/{cree['id_personnel']}",
        json={"est_administrateur": True},
        headers=entete,
    )

    assert reponse.status_code == 200
    assert reponse.json()["est_administrateur"] is False

    en_base = db.get(Personnel, cree["id_personnel"])
    assert en_base is not None
    assert en_base.est_administrateur is False


def test_mot_de_passe_ni_ecrit_ni_lu_par_l_api(
    client_http: TestClient, entete: dict[str, str], db: Session
) -> None:
    """Une empreinte n'a rien à faire dans une réponse, et l'API ne doit pas
    pouvoir en poser une."""
    reponse = client_http.post(
        PERSONNEL, json={**VALIDE, "mot_de_passe": "MotDePasse123456"}, headers=entete
    )

    assert reponse.status_code == 201
    assert "mot_de_passe" not in reponse.json()

    en_base = db.get(Personnel, reponse.json()["id_personnel"])
    assert en_base is not None
    assert en_base.mot_de_passe is None


def test_les_champs_sensibles_sont_absents_du_schema_ouvert() -> None:
    """Verrou de conception, indépendant du comportement de Pydantic.

    Si quelqu'un rétablit ces champs dans les schemas d'entrée, ce test tombe
    même si les trois précédents continuaient de passer par accident.
    """
    from app.schemas.personnel import PersonnelCreate, PersonnelUpdate

    for schema in (PersonnelCreate, PersonnelUpdate):
        assert "est_administrateur" not in schema.model_fields
        assert "mot_de_passe" not in schema.model_fields


# --- Cloisonnement et niveaux d'accès de l'annuaire ----------------------------


def test_un_jeton_client_n_ouvre_rien_dans_l_annuaire(
    client_http: TestClient, entete_client: dict[str, str]
) -> None:
    """Lecture comprise : un annuaire de salariés n'a pas à être lisible par la
    clientèle."""
    assert client_http.get(PERSONNEL, headers=entete_client).status_code == 401
    assert (
        client_http.post(PERSONNEL, json=VALIDE, headers=entete_client).status_code
        == 401
    )


def test_un_salarie_peut_consulter_l_annuaire(
    client_http: TestClient, entete: dict[str, str], entete_agent: dict[str, str]
) -> None:
    """Savoir qui livre ou qui forme fait partie du travail courant."""
    _creer(client_http, entete)

    reponse = client_http.get(PERSONNEL, headers=entete_agent)

    assert reponse.status_code == 200
    assert any(p["email"] == "jean@delta.mg" for p in reponse.json())


def test_un_salarie_sans_droit_ne_peut_pas_ecrire(
    client_http: TestClient, entete: dict[str, str], entete_agent: dict[str, str]
) -> None:
    """Gérer le personnel n'est pas le consulter — 403 sur les quatre écritures."""
    cree = _creer(client_http, entete)
    cible = f"{PERSONNEL}/{cree['id_personnel']}"

    assert (
        client_http.post(
            PERSONNEL, json={**VALIDE, "email": "x@delta.mg"}, headers=entete_agent
        ).status_code
        == 403
    )
    assert (
        client_http.put(cible, json={"nom": "Rabe"}, headers=entete_agent).status_code
        == 403
    )
    assert client_http.delete(cible, headers=entete_agent).status_code == 403
    assert (
        client_http.post(f"{cible}/restauration", headers=entete_agent).status_code
        == 403
    )


def test_sans_jeton_aucune_lecture(client_http: TestClient) -> None:
    assert client_http.get(PERSONNEL).status_code == 401


# --- Connexion du personnel ----------------------------------------------------


CONNEXION_PERSONNEL = f"{settings.API_V1_PREFIX}/auth/personnel/connexion"


def test_connexion_personnel_retourne_un_jeton_utilisable(
    client_http: TestClient, db: Session
) -> None:
    """Bout en bout : connexion, puis usage du jeton obtenu sur l'annuaire."""
    db.add(
        Personnel(
            nom="Chef",
            prenom="Grand",
            fonction=FonctionPersonnel.AUTRE,
            email="chef@delta.mg",
            est_administrateur=True,
            mot_de_passe=hacher_mot_de_passe("motdepasse123"),
        )
    )
    db.commit()

    reponse = client_http.post(
        CONNEXION_PERSONNEL,
        json={"email": "chef@delta.mg", "mot_de_passe": "motdepasse123"},
    )

    assert reponse.status_code == 200
    jeton = reponse.json()["access_token"]
    entete = {"Authorization": f"Bearer {jeton}"}
    assert client_http.post(PERSONNEL, json=VALIDE, headers=entete).status_code == 201


def test_connexion_personnel_refusee_donne_401(client_http: TestClient) -> None:
    reponse = client_http.post(
        CONNEXION_PERSONNEL,
        json={"email": "inconnu@delta.mg", "mot_de_passe": "motdepasse123"},
    )

    assert reponse.status_code == 401


def test_aucune_inscription_au_personnel_n_est_exposee(client_http: TestClient) -> None:
    """Un salarié est créé par l'annuaire ou le script d'amorçage, jamais en
    s'inscrivant lui-même — ce serait laisser n'importe qui entrer dans
    l'organigramme."""
    reponse = client_http.post(
        f"{settings.API_V1_PREFIX}/auth/personnel/inscription",
        json={"email": "pirate@delta.mg", "mot_de_passe": "motdepasse123"},
    )

    assert reponse.status_code == 404
