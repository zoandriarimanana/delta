"""Tests HTTP des photos du catalogue, rangées sur disque (`static/upload/`).

Vrais service et base (`session_postgres`) pour les éléments du catalogue ;
`UPLOAD_DIR` pointe vers un dossier temporaire (`tmp_path`) — un test ne doit
jamais écrire dans le vrai dossier d'upload du dépôt. Les images sont
fabriquées par Pillow.
"""

import io
from collections.abc import Iterator
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, hacher_mot_de_passe
from app.main import app
from app.models.categorie_produit import CategorieProduit
from app.models.domaine_formation import DomaineFormation
from app.models.formation import Formation
from app.models.logement import Logement, StatutLogement
from app.models.personnel import FonctionPersonnel, Personnel
from app.models.produit import Produit
from app.models.salle import Salle
from app.services import galerie_service
from tests.conftest import authentifier

PREFIXE = settings.API_V1_PREFIX


@pytest.fixture
def dossier(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture
def db(session_postgres: Session) -> Session:
    session_postgres.expire_on_commit = False  # comme `SessionLocal`
    return session_postgres


@pytest.fixture
def client_http(db: Session, dossier: Path) -> Iterator[TestClient]:
    def _get_db() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as testeur:
            yield testeur
    finally:
        app.dependency_overrides.clear()


def _agent(db: Session, *, administrateur: bool) -> dict[str, str]:
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=f"agent_{uuid4().hex[:8]}@delta.mg",
        est_administrateur=administrateur,
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(agent)
    db.commit()
    return authentifier(agent.id_personnel, TypeSujet.PERSONNEL)


@pytest.fixture
def admin(db: Session) -> dict[str, str]:
    return _agent(db, administrateur=True)


@pytest.fixture
def salle(db: Session) -> Salle:
    objet = Salle(nom="Salle Galerie", capacite=20, tarif_horaire=Decimal("10.00"))
    db.add(objet)
    db.commit()
    return objet


@pytest.fixture
def logement(db: Session) -> Logement:
    objet = Logement(
        type_chambre="Double",
        capacite=2,
        tarif_nuitee=Decimal("50.00"),
        statut=StatutLogement.DISPONIBLE,
    )
    db.add(objet)
    db.commit()
    return objet


@pytest.fixture
def formation(db: Session) -> Formation:
    domaine = DomaineFormation(libelle=f"Domaine {uuid4().hex[:8]}")
    db.add(domaine)
    db.flush()
    objet = Formation(
        titre="Atelier galerie",
        duree_heures=3,
        prix=Decimal("20.00"),
        capacite_max=8,
        id_domaine=domaine.id_domaine,
    )
    db.add(objet)
    db.commit()
    return objet


@pytest.fixture
def produit(db: Session) -> Produit:
    categorie = CategorieProduit(libelle=f"Catégorie {uuid4().hex[:8]}")
    db.add(categorie)
    db.flush()
    objet = Produit(
        nom="Tarte galerie",
        prix_unitaire=Decimal("5.00"),
        unite_mesure="piece",
        stock_disponible=3,
        id_categorie=categorie.id_categorie,
    )
    db.add(objet)
    db.commit()
    return objet


def _image(format_pillow: str = "PNG") -> bytes:
    tampon = io.BytesIO()
    Image.new("RGB", (8, 8), (156, 74, 60)).save(tampon, format=format_pillow)
    return tampon.getvalue()


def _envoyer(
    client_http: TestClient,
    chemin: str,
    entetes: dict[str, str],
    contenu: bytes | None = None,
    type_mime: str = "image/png",
):
    return client_http.post(
        f"{PREFIXE}{chemin}",
        headers=entetes,
        files={"fichier": ("../../evasion.png", contenu or _image(), type_mime)},
    )


# --- Rangement sur disque -----------------------------------------------------


def test_la_photo_est_rangee_dans_le_dossier_de_sa_partie(
    client_http: TestClient, admin: dict[str, str], salle: Salle, dossier: Path
) -> None:
    contenu = _image("JPEG")
    reponse = _envoyer(
        client_http, f"/salles/{salle.id_salle}/photos", admin, contenu, "image/jpeg"
    )

    assert reponse.status_code == 201
    nom = f"{salle.id_salle}-1.jpg"
    assert reponse.json() == {"fichier": nom}
    assert (dossier / "salles" / nom).read_bytes() == contenu
    # Le nom envoyé (`../../evasion.png`) n'est jamais utilisé.
    assert not list(dossier.rglob("evasion*"))


@pytest.mark.parametrize(
    ("partie", "fixture"),
    [
        ("logements", "logement"),
        ("formations", "formation"),
        ("produits", "produit"),
    ],
)
def test_chaque_partie_a_son_dossier(
    client_http: TestClient,
    admin: dict[str, str],
    dossier: Path,
    request: pytest.FixtureRequest,
    partie: str,
    fixture: str,
) -> None:
    element = request.getfixturevalue(fixture)
    identifiant = next(
        getattr(element, attribut)
        for attribut in ("id_logement", "id_formation", "id_produit")
        if hasattr(element, attribut)
    )

    reponse = _envoyer(client_http, f"/{partie}/{identifiant}/photos", admin)

    assert reponse.status_code == 201
    assert (dossier / partie / f"{identifiant}-1.png").is_file()


def test_les_numeros_se_suivent_et_l_extension_suit_le_format_detecte(
    client_http: TestClient, admin: dict[str, str], logement: Logement
) -> None:
    """Un PNG déclaré `image/jpeg` est rangé en `.png` : seul le contenu fait
    foi."""
    chemin = f"/logements/{logement.id_logement}/photos"
    noms = [
        _envoyer(client_http, chemin, admin, _image(fmt), "image/jpeg").json()[
            "fichier"
        ]
        for fmt in ("PNG", "JPEG", "WEBP")
    ]

    i = logement.id_logement
    assert noms == [f"{i}-1.png", f"{i}-2.jpg", f"{i}-3.webp"]
    galerie = client_http.get(f"{PREFIXE}{chemin}").json()
    assert [p["fichier"] for p in galerie] == noms

    image = client_http.get(f"{PREFIXE}/photos/logements/{noms[0]}")
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"


def test_l_ordre_est_numerique_et_ignore_les_fichiers_etrangers(
    client_http: TestClient, salle: Salle, dossier: Path
) -> None:
    """Fichiers déposés à la main : `-10` vient après `-9`, et un fichier mal
    nommé ou appartenant à une autre salle est ignoré."""
    rangement = dossier / "salles"
    rangement.mkdir()
    i = salle.id_salle
    for nom in (f"{i}-10.jpg", f"{i}-9.jpg", f"{i}1-1.jpg", "notes.txt", f"{i}-a.jpg"):
        (rangement / nom).write_bytes(_image("JPEG"))

    galerie = client_http.get(f"{PREFIXE}/salles/{i}/photos").json()

    assert [p["fichier"] for p in galerie] == [f"{i}-9.jpg", f"{i}-10.jpg"]


def test_un_numero_libere_n_ecrase_pas_une_photo_existante(
    client_http: TestClient, admin: dict[str, str], salle: Salle
) -> None:
    chemin = f"/salles/{salle.id_salle}/photos"
    _envoyer(client_http, chemin, admin)
    deuxieme = _envoyer(client_http, chemin, admin).json()["fichier"]
    client_http.delete(f"{PREFIXE}/photos/salles/{salle.id_salle}-1.png", headers=admin)

    troisieme = _envoyer(client_http, chemin, admin).json()["fichier"]

    assert troisieme == f"{salle.id_salle}-3.png"
    assert [p["fichier"] for p in client_http.get(f"{PREFIXE}{chemin}").json()] == [
        deuxieme,
        troisieme,
    ]


# --- Refus --------------------------------------------------------------------


def test_un_salarie_non_administrateur_est_refuse(
    client_http: TestClient, db: Session, salle: Salle, dossier: Path
) -> None:
    salarie = _agent(db, administrateur=False)
    reponse = _envoyer(client_http, f"/salles/{salle.id_salle}/photos", salarie)
    assert reponse.status_code == 403
    assert not list(dossier.rglob("*.png"))


@pytest.mark.parametrize(
    ("contenu", "type_mime"),
    [
        (b"ceci n'est pas une image", "image/png"),
        (None, "application/pdf"),
        (None, "image/gif"),
    ],
    ids=["octets-mensongers", "type-pdf", "type-gif"],
)
def test_un_fichier_qui_n_est_pas_une_image_acceptee_est_refuse(
    client_http: TestClient,
    admin: dict[str, str],
    salle: Salle,
    contenu: bytes | None,
    type_mime: str,
) -> None:
    reponse = _envoyer(
        client_http, f"/salles/{salle.id_salle}/photos", admin, contenu, type_mime
    )
    assert reponse.status_code == 400
    assert "JPEG, PNG et WebP" in reponse.json()["detail"]


def test_un_gif_deguise_en_png_est_refuse(
    client_http: TestClient, admin: dict[str, str], salle: Salle
) -> None:
    reponse = _envoyer(
        client_http, f"/salles/{salle.id_salle}/photos", admin, _image("GIF")
    )
    assert reponse.status_code == 400


def test_une_image_trop_volumineuse_est_refusee(
    client_http: TestClient,
    admin: dict[str, str],
    salle: Salle,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(galerie_service, "TAILLE_MAX_PHOTO_OCTETS", 10)
    reponse = _envoyer(client_http, f"/salles/{salle.id_salle}/photos", admin)
    assert reponse.status_code == 400
    assert "5 Mio" in reponse.json()["detail"]


def test_la_galerie_est_bornee(
    client_http: TestClient,
    admin: dict[str, str],
    salle: Salle,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(galerie_service, "NOMBRE_MAX_PHOTOS", 2)
    chemin = f"/salles/{salle.id_salle}/photos"
    assert _envoyer(client_http, chemin, admin).status_code == 201
    assert _envoyer(client_http, chemin, admin).status_code == 201

    reponse = _envoyer(client_http, chemin, admin)
    assert reponse.status_code == 409
    assert "Retirez-en une" in reponse.json()["detail"]


def test_un_element_inconnu_donne_404(
    client_http: TestClient, admin: dict[str, str]
) -> None:
    assert client_http.get(f"{PREFIXE}/salles/999999/photos").status_code == 404
    assert _envoyer(client_http, "/produits/999999/photos", admin).status_code == 404


@pytest.mark.parametrize(
    "fichier",
    ["..%2F..%2Fapp%2Fmain.py", "1-1.gif", "1.jpg", "abc-1.jpg", "1-1.jpg.png.exe"],
)
def test_un_nom_de_fichier_hors_motif_donne_404(
    client_http: TestClient, fichier: str
) -> None:
    assert client_http.get(f"{PREFIXE}/photos/salles/{fichier}").status_code == 404


def test_une_partie_inconnue_est_refusee(client_http: TestClient) -> None:
    assert client_http.get(f"{PREFIXE}/photos/clients/1-1.jpg").status_code == 422


# --- Archivage et suppression -------------------------------------------------


def test_les_photos_d_un_element_archive_disparaissent_puis_reviennent(
    client_http: TestClient,
    admin: dict[str, str],
    db: Session,
    formation: Formation,
    dossier: Path,
) -> None:
    """Une URL de photo ne survit pas à la fiche qui la montrait ; restaurer
    l'élément la fait réapparaître, le fichier n'a pas bougé."""
    nom = _envoyer(
        client_http, f"/formations/{formation.id_formation}/photos", admin
    ).json()["fichier"]

    formation.supprime_le = func.now()
    db.commit()
    assert client_http.get(f"{PREFIXE}/photos/formations/{nom}").status_code == 404
    assert (dossier / "formations" / nom).is_file()

    formation.supprime_le = None
    db.commit()
    assert client_http.get(f"{PREFIXE}/photos/formations/{nom}").status_code == 200


def test_retirer_une_photo_l_efface_du_disque(
    client_http: TestClient, admin: dict[str, str], produit: Produit, dossier: Path
) -> None:
    nom = _envoyer(client_http, f"/produits/{produit.id_produit}/photos", admin).json()[
        "fichier"
    ]

    reponse = client_http.delete(f"{PREFIXE}/photos/produits/{nom}", headers=admin)

    assert reponse.status_code == 204
    assert not (dossier / "produits" / nom).exists()
    assert (
        client_http.delete(f"{PREFIXE}/photos/produits/{nom}", headers=admin)
    ).status_code == 404


def test_retirer_une_photo_exige_un_administrateur(
    client_http: TestClient, admin: dict[str, str], db: Session, salle: Salle
) -> None:
    nom = _envoyer(client_http, f"/salles/{salle.id_salle}/photos", admin).json()[
        "fichier"
    ]
    salarie = _agent(db, administrateur=False)

    reponse = client_http.delete(f"{PREFIXE}/photos/salles/{nom}", headers=salarie)
    assert reponse.status_code == 403


# --- Catégories, couvertures et modèles (14 octobre 2026) ----------------------


def test_une_categorie_porte_des_exemples_de_realisations(
    client_http: TestClient, admin: dict[str, str], produit: Produit, dossier: Path
) -> None:
    id_categorie = produit.id_categorie
    for _ in range(2):
        _envoyer(client_http, f"/categories-produit/{id_categorie}/photos", admin)

    liste = client_http.get(f"{PREFIXE}/categories-produit/{id_categorie}/photos")

    assert [p["fichier"] for p in liste.json()] == [
        f"{id_categorie}-1.png",
        f"{id_categorie}-2.png",
    ]
    assert (dossier / "categories" / f"{id_categorie}-1.png").is_file()


def test_les_couvertures_d_une_partie_arrivent_en_une_requete(
    client_http: TestClient, admin: dict[str, str], salle: Salle
) -> None:
    for _ in range(3):
        _envoyer(client_http, f"/salles/{salle.id_salle}/photos", admin)
    client_http.delete(f"{PREFIXE}/photos/salles/{salle.id_salle}-1.png", headers=admin)

    couvertures = client_http.get(f"{PREFIXE}/photos/salles/couvertures")

    assert couvertures.status_code == 200
    # La première photo **restante** sert de couverture.
    assert couvertures.json()[str(salle.id_salle)] == f"{salle.id_salle}-2.png"


def _client_personnalisant(db: Session, produit: Produit) -> dict[str, str]:
    from app.models.client import Client, TypeClient

    produit.est_personnalisable = True
    produit.supplement_personnalisation = Decimal("2.00")
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"modele_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("MotDePasse123!"),
    )
    db.add(compte)
    db.commit()
    return authentifier(compte.id_client, TypeSujet.CLIENT)


def _commander(
    client_http: TestClient,
    entete: dict[str, str],
    produit: Produit,
    modele: str,
    source: str = "categories",
):
    return client_http.post(
        f"{PREFIXE}/commandes",
        headers=entete,
        json={
            "type_commande": "A_emporter",
            "lignes": [
                {
                    "id_produit": produit.id_produit,
                    "quantite": 1,
                    "personnalisation": {
                        "description_demande": "Message : Joyeux anniversaire",
                        "photo_modele": modele,
                        "source_modele": source,
                    },
                }
            ],
        },
    )


def test_le_modele_choisi_est_copie_avec_la_commande(
    client_http: TestClient,
    admin: dict[str, str],
    produit: Produit,
    db: Session,
    dossier: Path,
) -> None:
    id_categorie = produit.id_categorie
    contenu = _image("JPEG")
    _envoyer(
        client_http,
        f"/categories-produit/{id_categorie}/photos",
        admin,
        contenu,
        "image/jpeg",
    )
    entete = _client_personnalisant(db, produit)

    reponse = _commander(client_http, entete, produit, f"{id_categorie}-1.jpg")

    assert reponse.status_code == 201, reponse.text
    demande = reponse.json()["lignes"][0]["personnalisation"]
    copie = demande["photo_modele"]
    assert copie == f"{demande['id_personnalisation']}-1.jpg"
    assert (dossier / "modeles" / copie).read_bytes() == contenu
    # La copie se lit comme toute photo, et survit au retrait de l'original.
    client_http.delete(
        f"{PREFIXE}/photos/categories/{id_categorie}-1.jpg", headers=admin
    )
    assert client_http.get(f"{PREFIXE}/photos/modeles/{copie}").status_code == 200


def test_un_modele_d_une_autre_categorie_est_refuse(
    client_http: TestClient,
    admin: dict[str, str],
    produit: Produit,
    salle: Salle,
    db: Session,
) -> None:
    _envoyer(client_http, f"/salles/{salle.id_salle}/photos", admin)
    entete = _client_personnalisant(db, produit)

    reponse = _commander(
        client_http, entete, produit, f"{produit.id_categorie + 999}-1.png"
    )

    assert reponse.status_code == 422
    assert "exemples" in reponse.json()["detail"]


def test_une_photo_du_produit_peut_servir_de_modele(
    client_http: TestClient,
    admin: dict[str, str],
    produit: Produit,
    db: Session,
    dossier: Path,
) -> None:
    """Demande du 14 octobre 2026 : le client choisit une photo de la galerie
    du produit lui-même, et la retrouve avec sa commande."""
    contenu = _image("JPEG")
    galerie = f"/produits/{produit.id_produit}/photos"
    _envoyer(client_http, galerie, admin, contenu, "image/jpeg")
    entete = _client_personnalisant(db, produit)

    reponse = _commander(
        client_http, entete, produit, f"{produit.id_produit}-1.jpg", "produits"
    )

    assert reponse.status_code == 201, reponse.text
    copie = reponse.json()["lignes"][0]["personnalisation"]["photo_modele"]
    assert (dossier / "modeles" / copie).read_bytes() == contenu


def test_la_photo_d_un_autre_produit_est_refusee(
    client_http: TestClient, produit: Produit, db: Session
) -> None:
    entete = _client_personnalisant(db, produit)

    reponse = _commander(
        client_http, entete, produit, f"{produit.id_produit + 999}-1.jpg", "produits"
    )

    assert reponse.status_code == 422
