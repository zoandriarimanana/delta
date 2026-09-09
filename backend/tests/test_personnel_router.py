"""Tests HTTP des endpoints de PERSONNEL.

Montés sur l'application réelle de `app/main.py`, seule la session étant
substituée : c'est elle qui porte la traduction des erreurs métier en codes HTTP.

Point de vigilance propre à ce module : **les lectures aussi sont protégées**,
contrairement au catalogue produit. Un annuaire du personnel porte des données
personnelles de salariés, rien n'y a vocation à être lisible anonymement.

Deux niveaux depuis #23 : lecture par tout salarié authentifié, écriture par les
seuls administrateurs. Un jeton client n'ouvre plus rien ici.
"""

import io
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.cookies import NOM_COOKIE_CSRF, NOM_COOKIE_SESSION
from app.core.database import get_db
from app.core.security import TypeSujet, hacher_mot_de_passe, verifier_mot_de_passe
from app.main import app
from app.models.client import Client, TypeClient
from app.models.personnel import FonctionPersonnel, Personnel
from tests.conftest import authentifier, creer_engine_sqlite


def _octets_png() -> bytes:
    tampon = io.BytesIO()
    Image.new("RGB", (8, 8), color="blue").save(tampon, format="PNG")
    return tampon.getvalue()


@pytest.fixture(autouse=True)
def _dossier_photos_isole(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Même isolation que `test_personnel_service.py` — voir sa docstring."""
    monkeypatch.setattr(settings, "PHOTO_STORAGE_DIR", str(tmp_path))


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
    return authentifier(agent.id_personnel, TypeSujet.PERSONNEL)


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
    return authentifier(client.id_client, TypeSujet.CLIENT)


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
        ("post", "/1/anonymisation"),
        ("get", "/1/photo"),
        ("post", "/1/photo"),
        ("delete", "/1/photo"),
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
        PERSONNEL, headers={"Cookie": f"{NOM_COOKIE_SESSION}=pas.un.jeton"}
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


# --- Anonymisation --------------------------------------------------------------


def test_anonymisation(client_http: TestClient, entete: dict[str, str]) -> None:
    cree = _creer(client_http, entete)

    reponse = client_http.post(
        f"{PERSONNEL}/{cree['id_personnel']}/anonymisation", headers=entete
    )

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["nom"] == "Anonymisé"
    assert corps["prenom"] == "Anonymisé"
    assert corps["email"].endswith("@delta.invalid")
    assert corps["est_administrateur"] is False


def test_anonymisation_efface_les_donnees_en_base(
    client_http: TestClient, entete: dict[str, str], db: Session
) -> None:
    """Vérifie l'état réellement persisté, pas seulement la réponse HTTP.

    `db.get()` lit par clé primaire, sans le filtre d'archivage que
    `PersonnelRepository.get_by_id` applique par défaut — c'est la même
    preuve que celle obtenue manuellement via `psql` lors de la vérification
    empirique, rejouée ici automatiquement. `db.expire_all()` force une
    relecture réelle plutôt que de faire confiance à l'objet Python déjà en
    mémoire, identique à celui que le service vient de muter.
    """
    cree = _creer(client_http, entete, telephone="+261340000000")
    cible = db.get(Personnel, cree["id_personnel"])
    assert cible is not None
    cible.mot_de_passe = hacher_mot_de_passe("motdepasse123")
    cible.specialite = "Pâtisserie"
    db.commit()
    ancienne_empreinte = cible.mot_de_passe

    reponse = client_http.post(
        f"{PERSONNEL}/{cree['id_personnel']}/anonymisation", headers=entete
    )
    assert reponse.status_code == 200

    db.expire_all()
    en_base = db.get(Personnel, cree["id_personnel"])
    assert en_base is not None
    assert en_base.nom == "Anonymisé"
    assert en_base.prenom == "Anonymisé"
    assert en_base.telephone is None
    assert en_base.specialite is None
    assert en_base.zone_livraison is None
    assert en_base.email.endswith("@delta.invalid")
    assert en_base.est_administrateur is False
    assert en_base.supprime_le is not None
    # Le mot de passe n'est pas seulement changé : l'ancien ne fonctionne
    # plus, ce qui rend toute connexion future impossible.
    assert en_base.mot_de_passe != ancienne_empreinte
    assert not verifier_mot_de_passe("motdepasse123", en_base.mot_de_passe)


def test_anonymisation_archive_aussi(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    """L'annuaire ne montre plus la ligne, même si elle est lisible en base."""
    cree = _creer(client_http, entete)

    client_http.post(
        f"{PERSONNEL}/{cree['id_personnel']}/anonymisation", headers=entete
    )

    assert (
        client_http.get(
            f"{PERSONNEL}/{cree['id_personnel']}", headers=entete
        ).status_code
        == 404
    )


def test_anonymisation_d_un_inconnu_donne_404(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    reponse = client_http.post(f"{PERSONNEL}/999999/anonymisation", headers=entete)

    assert reponse.status_code == 404


def test_anonymisation_reste_possible_sur_une_ligne_deja_archivee(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    """L'archivage seul ne suffit pas à effacer les données : anonymiser une
    ligne déjà archivée doit rester possible, pas répondre 404."""
    cree = _creer(client_http, entete)
    client_http.delete(f"{PERSONNEL}/{cree['id_personnel']}", headers=entete)

    reponse = client_http.post(
        f"{PERSONNEL}/{cree['id_personnel']}/anonymisation", headers=entete
    )

    assert reponse.status_code == 200
    assert reponse.json()["nom"] == "Anonymisé"


def test_anonymisation_est_idempotente(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    cree = _creer(client_http, entete)
    cible = f"{PERSONNEL}/{cree['id_personnel']}/anonymisation"

    premiere = client_http.post(cible, headers=entete)
    seconde = client_http.post(cible, headers=entete)

    assert premiere.status_code == 200
    assert seconde.status_code == 200
    assert premiere.json()["email"] == seconde.json()["email"]


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
    """Gérer le personnel n'est pas le consulter — 403 sur les cinq écritures."""
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
    assert (
        client_http.post(f"{cible}/anonymisation", headers=entete_agent).status_code
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
    assert reponse.json() == {"type": "personnel"}
    # `client_http` gère les `Set-Cookie` comme un vrai navigateur : le cookie
    # de session est déjà posé. Seul le jeton anti-CSRF doit être relu et
    # renvoyé en en-tête — exactement le geste qu'un vrai frontend ferait.
    entete = {"X-CSRF-Token": client_http.cookies[NOM_COOKIE_CSRF]}
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


# --- Photo de profil -----------------------------------------------------------


def test_obtenir_photo_absente_donne_404(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    """Un membre sans photo se traduit en 404 — comme s'il n'existait pas,
    même refus pour les deux cas côté frontend (l'avatar générique)."""
    cree = _creer(client_http, entete)

    reponse = client_http.get(
        f"{PERSONNEL}/{cree['id_personnel']}/photo", headers=entete
    )

    assert reponse.status_code == 404


def test_obtenir_photo_est_ouverte_a_tout_salarie(
    client_http: TestClient, entete: dict[str, str], entete_agent: dict[str, str]
) -> None:
    """Lecture, pas écriture : même niveau que `GET /personnel`."""
    cree = _creer(client_http, entete)
    client_http.post(
        f"{PERSONNEL}/{cree['id_personnel']}/photo",
        files={"fichier": ("photo.png", _octets_png(), "image/png")},
        headers=entete,
    )

    reponse = client_http.get(
        f"{PERSONNEL}/{cree['id_personnel']}/photo", headers=entete_agent
    )

    assert reponse.status_code == 200
    assert reponse.headers["content-type"] == "image/png"
    assert reponse.headers["cache-control"] == "no-store"


def test_obtenir_photo_refuse_un_jeton_client(
    client_http: TestClient, entete: dict[str, str], entete_client: dict[str, str]
) -> None:
    cree = _creer(client_http, entete)

    reponse = client_http.get(
        f"{PERSONNEL}/{cree['id_personnel']}/photo", headers=entete_client
    )

    assert reponse.status_code == 401


def test_televerser_photo_reussie_donne_204(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    cree = _creer(client_http, entete)

    reponse = client_http.post(
        f"{PERSONNEL}/{cree['id_personnel']}/photo",
        files={"fichier": ("photo.png", _octets_png(), "image/png")},
        headers=entete,
    )

    assert reponse.status_code == 204
    assert (
        client_http.get(
            f"{PERSONNEL}/{cree['id_personnel']}/photo", headers=entete
        ).status_code
        == 200
    )


def test_televerser_photo_refusee_a_un_salarie_sans_droit(
    client_http: TestClient, entete: dict[str, str], entete_agent: dict[str, str]
) -> None:
    """Écriture, réservée aux administrateurs — même niveau que le reste des
    écritures de cet annuaire."""
    cree = _creer(client_http, entete)

    reponse = client_http.post(
        f"{PERSONNEL}/{cree['id_personnel']}/photo",
        files={"fichier": ("photo.png", _octets_png(), "image/png")},
        headers=entete_agent,
    )

    assert reponse.status_code == 403


def test_televerser_un_contenu_invalide_donne_400(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    cree = _creer(client_http, entete)

    reponse = client_http.post(
        f"{PERSONNEL}/{cree['id_personnel']}/photo",
        files={"fichier": ("photo.png", b"pas une image", "image/png")},
        headers=entete,
    )

    assert reponse.status_code == 400


def test_televerser_sur_un_inconnu_donne_404(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    reponse = client_http.post(
        f"{PERSONNEL}/99999/photo",
        files={"fichier": ("photo.png", _octets_png(), "image/png")},
        headers=entete,
    )

    assert reponse.status_code == 404


def test_supprimer_photo_reussie_donne_204_et_efface(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    cree = _creer(client_http, entete)
    client_http.post(
        f"{PERSONNEL}/{cree['id_personnel']}/photo",
        files={"fichier": ("photo.png", _octets_png(), "image/png")},
        headers=entete,
    )

    reponse = client_http.delete(
        f"{PERSONNEL}/{cree['id_personnel']}/photo", headers=entete
    )

    assert reponse.status_code == 204
    assert (
        client_http.get(
            f"{PERSONNEL}/{cree['id_personnel']}/photo", headers=entete
        ).status_code
        == 404
    )


def test_supprimer_photo_refusee_a_un_salarie_sans_droit(
    client_http: TestClient, entete: dict[str, str], entete_agent: dict[str, str]
) -> None:
    cree = _creer(client_http, entete)

    reponse = client_http.delete(
        f"{PERSONNEL}/{cree['id_personnel']}/photo", headers=entete_agent
    )

    assert reponse.status_code == 403


def test_supprimer_photo_sans_photo_reste_un_succes(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    """Idempotent : pas d'erreur à retirer ce qui n'existe pas déjà."""
    cree = _creer(client_http, entete)

    reponse = client_http.delete(
        f"{PERSONNEL}/{cree['id_personnel']}/photo", headers=entete
    )

    assert reponse.status_code == 204
