"""Tests HTTP de la galerie des salles et logements (PHOTO_BIEN).

Vrais service et base (`session_postgres`) : les octets vont réellement en
`bytea`, les contraintes (`cible_xor`, `CASCADE`) sont celles de PostgreSQL.
Les images sont fabriquées par Pillow, jamais des fichiers du dépôt.
"""

import io
from collections.abc import Iterator
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, hacher_mot_de_passe
from app.main import app
from app.models.logement import Logement, StatutLogement
from app.models.personnel import FonctionPersonnel, Personnel
from app.models.photo_bien import FormatPhoto, PhotoBien
from app.models.salle import Salle
from app.repositories.salle_repository import SalleRepository
from app.services import photo_bien_service
from tests.conftest import authentifier

PREFIXE = settings.API_V1_PREFIX


@pytest.fixture
def db(session_postgres: Session) -> Session:
    session_postgres.expire_on_commit = False  # comme `SessionLocal`
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
    legende: str | None = None,
):
    donnees = {"legende": legende} if legende is not None else None
    return client_http.post(
        f"{PREFIXE}{chemin}",
        headers=entetes,
        files={"fichier": ("photo.png", contenu or _image(), type_mime)},
        data=donnees,
    )


# --- Écriture et lecture ------------------------------------------------------


def test_un_administrateur_ajoute_une_photo_lisible_publiquement(
    client_http: TestClient, admin: dict[str, str], salle: Salle
) -> None:
    contenu = _image("JPEG")
    reponse = _envoyer(
        client_http,
        f"/salles/{salle.id_salle}/photos",
        admin,
        contenu,
        "image/jpeg",
        legende="  Vue depuis l'entrée  ",
    )

    assert reponse.status_code == 201
    photo = reponse.json()
    assert photo["legende"] == "Vue depuis l'entrée"
    assert "contenu" not in photo, "les octets ne voyagent jamais dans une liste"

    galerie = client_http.get(f"{PREFIXE}/salles/{salle.id_salle}/photos")
    assert galerie.status_code == 200
    assert galerie.json() == [photo]

    image = client_http.get(f"{PREFIXE}/photos-biens/{photo['id_photo']}")
    assert image.status_code == 200
    assert image.content == contenu
    assert image.headers["content-type"] == "image/jpeg"
    assert "immutable" in image.headers["cache-control"]


def test_le_type_renvoye_est_celui_detecte_pas_celui_declare(
    client_http: TestClient, admin: dict[str, str], logement: Logement
) -> None:
    """Un PNG déclaré `image/jpeg` est servi en PNG : seul le contenu fait foi."""
    reponse = _envoyer(
        client_http,
        f"/logements/{logement.id_logement}/photos",
        admin,
        _image("PNG"),
        "image/jpeg",
    )
    assert reponse.status_code == 201

    image = client_http.get(f"{PREFIXE}/photos-biens/{reponse.json()['id_photo']}")
    assert image.headers["content-type"] == "image/png"


def test_la_galerie_suit_l_ordre_d_ajout(
    client_http: TestClient, admin: dict[str, str], logement: Logement
) -> None:
    chemin = f"/logements/{logement.id_logement}/photos"
    ids = [
        _envoyer(client_http, chemin, admin, legende=str(rang)).json()["id_photo"]
        for rang in range(3)
    ]

    galerie = client_http.get(f"{PREFIXE}{chemin}").json()
    assert [p["id_photo"] for p in galerie] == ids


def test_la_galerie_d_une_salle_ne_montre_pas_celle_d_un_logement(
    client_http: TestClient, admin: dict[str, str], salle: Salle, logement: Logement
) -> None:
    _envoyer(client_http, f"/logements/{logement.id_logement}/photos", admin)

    assert client_http.get(f"{PREFIXE}/salles/{salle.id_salle}/photos").json() == []


# --- Refus --------------------------------------------------------------------


def test_un_salarie_non_administrateur_est_refuse(
    client_http: TestClient, db: Session, salle: Salle
) -> None:
    salarie = _agent(db, administrateur=False)
    reponse = _envoyer(client_http, f"/salles/{salle.id_salle}/photos", salarie)
    assert reponse.status_code == 403


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
    """Pillow lit le GIF : c'est le domaine de formats, pas la lecture, qui
    refuse."""
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
    monkeypatch.setattr(photo_bien_service, "TAILLE_MAX_PHOTO_OCTETS", 10)
    reponse = _envoyer(client_http, f"/salles/{salle.id_salle}/photos", admin)
    assert reponse.status_code == 400
    assert "5 Mio" in reponse.json()["detail"]


def test_une_legende_trop_longue_est_refusee(
    client_http: TestClient, admin: dict[str, str], salle: Salle
) -> None:
    reponse = _envoyer(
        client_http, f"/salles/{salle.id_salle}/photos", admin, legende="x" * 201
    )
    assert reponse.status_code == 422


def test_la_galerie_est_bornee(
    client_http: TestClient,
    admin: dict[str, str],
    salle: Salle,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(photo_bien_service, "NOMBRE_MAX_PHOTOS", 2)
    chemin = f"/salles/{salle.id_salle}/photos"
    assert _envoyer(client_http, chemin, admin).status_code == 201
    assert _envoyer(client_http, chemin, admin).status_code == 201

    reponse = _envoyer(client_http, chemin, admin)
    assert reponse.status_code == 409
    assert "Retirez-en une" in reponse.json()["detail"]


def test_un_bien_inconnu_donne_404(
    client_http: TestClient, admin: dict[str, str]
) -> None:
    assert client_http.get(f"{PREFIXE}/salles/999999/photos").status_code == 404
    assert _envoyer(client_http, "/logements/999999/photos", admin).status_code == 404


# --- Archivage et suppression -------------------------------------------------


def test_la_galerie_d_un_bien_archive_disparait_puis_revient(
    client_http: TestClient, admin: dict[str, str], db: Session, salle: Salle
) -> None:
    """Une URL de photo ne survit pas à la fiche qui la montrait ; restaurer
    le bien la fait réapparaître, rien n'a été effacé."""
    id_photo = _envoyer(client_http, f"/salles/{salle.id_salle}/photos", admin).json()[
        "id_photo"
    ]
    depot = SalleRepository(db)

    depot.delete(salle)
    db.commit()
    assert (
        client_http.get(f"{PREFIXE}/salles/{salle.id_salle}/photos").status_code == 404
    )
    assert client_http.get(f"{PREFIXE}/photos-biens/{id_photo}").status_code == 404

    depot.restaurer(salle)
    db.commit()
    assert client_http.get(f"{PREFIXE}/photos-biens/{id_photo}").status_code == 200


def test_retirer_une_photo_l_efface_reellement(
    client_http: TestClient, admin: dict[str, str], db: Session, salle: Salle
) -> None:
    id_photo = _envoyer(client_http, f"/salles/{salle.id_salle}/photos", admin).json()[
        "id_photo"
    ]

    reponse = client_http.delete(f"{PREFIXE}/photos-biens/{id_photo}", headers=admin)

    assert reponse.status_code == 204
    assert db.get(PhotoBien, id_photo) is None, "pas d'archivage : un vrai DELETE"
    assert client_http.get(f"{PREFIXE}/photos-biens/{id_photo}").status_code == 404
    assert (
        client_http.delete(f"{PREFIXE}/photos-biens/{id_photo}", headers=admin)
    ).status_code == 404


def test_retirer_une_photo_exige_un_administrateur(
    client_http: TestClient, admin: dict[str, str], db: Session, salle: Salle
) -> None:
    id_photo = _envoyer(client_http, f"/salles/{salle.id_salle}/photos", admin).json()[
        "id_photo"
    ]
    salarie = _agent(db, administrateur=False)

    reponse = client_http.delete(f"{PREFIXE}/photos-biens/{id_photo}", headers=salarie)
    assert reponse.status_code == 403


def test_supprimer_definitivement_le_bien_emporte_sa_galerie(
    db: Session, salle: Salle
) -> None:
    photo = PhotoBien(
        contenu=_image(),
        format=FormatPhoto.PNG,
        taille_octets=10,
        id_salle=salle.id_salle,
    )
    db.add(photo)
    db.commit()
    id_photo = photo.id_photo

    SalleRepository(db).supprimer_definitivement(salle)
    db.commit()
    db.expire_all()

    assert db.get(PhotoBien, id_photo) is None


@pytest.mark.parametrize("deux_biens", [True, False], ids=["deux-biens", "aucun"])
def test_une_photo_appartient_a_exactement_un_bien(
    db: Session, salle: Salle, logement: Logement, deux_biens: bool
) -> None:
    db.add(
        PhotoBien(
            contenu=_image(),
            format=FormatPhoto.PNG,
            taille_octets=10,
            id_salle=salle.id_salle if deux_biens else None,
            id_logement=logement.id_logement if deux_biens else None,
        )
    )
    with pytest.raises(IntegrityError, match="ck_photo_bien_cible_xor"):
        db.flush()
