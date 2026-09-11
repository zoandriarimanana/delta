"""Tests HTTP du catalogue de formation.

Montés sur l'application réelle, seule la session étant substituée : c'est elle
qui porte la traduction des erreurs métier en codes HTTP.

Le point de vigilance est le réglage d'accès : **lectures publiques, écritures
réservées aux administrateurs**. C'est celui du catalogue produit, et il tient à
la nature de la donnée — une offre de formation est publiée, contrairement à
l'annuaire du personnel.

Contre PostgreSQL, et non plus un SQLite minimal (revu en 8.3) : la fiche
formation (`GET /formations/{id}`) interroge désormais `AVIS` via
`RESERVATION`, qui porte une contrainte d'exclusion `EXCLUDE USING gist` que
SQLite ne sait pas créer — même raison que `test_salle_router.py`.
"""

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TypeSujet, hacher_mot_de_passe
from app.main import app
from app.models.client import Client, TypeClient
from app.models.personnel import FonctionPersonnel, Personnel
from tests.conftest import authentifier

pytestmark = pytest.mark.postgres

DOMAINES = f"{settings.API_V1_PREFIX}/domaines-formation"
FORMATIONS = f"{settings.API_V1_PREFIX}/formations"
MDP = "motdepasse123"


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
        # `app` est un singleton de module : sans nettoyage, la substitution
        # fuiterait sur les tests suivants.
        app.dependency_overrides.clear()


def _jeton_personnel(db: Session, *, administrateur: bool) -> dict[str, str]:
    agent = Personnel(
        nom="Agent",
        prenom="Test",
        fonction=FonctionPersonnel.FORMATEUR,
        email=f"agent_{uuid4().hex[:8]}@delta.mg",
        est_administrateur=administrateur,
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(agent)
    db.commit()
    return authentifier(agent.id_personnel, TypeSujet.PERSONNEL)


@pytest.fixture
def entete_admin(db: Session) -> dict[str, str]:
    return _jeton_personnel(db, administrateur=True)


@pytest.fixture
def entete_agent(db: Session) -> dict[str, str]:
    """Salarié authentifié, sans droit d'administration.

    Un formateur, précisément : administrer le catalogue vient de
    `est_administrateur`, jamais de la fonction exercée.
    """
    return _jeton_personnel(db, administrateur=False)


@pytest.fixture
def entete_client(db: Session) -> dict[str, str]:
    client = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"jean_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe(MDP),
    )
    db.add(client)
    db.commit()
    return authentifier(client.id_client, TypeSujet.CLIENT)


@pytest.fixture
def id_domaine(client_http: TestClient, entete_admin: dict[str, str]) -> int:
    reponse = client_http.post(
        DOMAINES, json={"libelle": "Pâtisserie"}, headers=entete_admin
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["id_domaine"]


def _formation(id_domaine: int, **extra: object) -> dict:
    return {
        "titre": "CAP Pâtissier",
        "duree_heures": 140,
        "prix": "850000.00",
        "capacite_max": 12,
        "id_domaine": id_domaine,
        **extra,
    }


# --- Lectures publiques -------------------------------------------------------


def test_les_lectures_sont_publiques(client_http: TestClient, id_domaine: int) -> None:
    """Un visiteur doit pouvoir parcourir l'offre sans compte."""
    assert client_http.get(DOMAINES).status_code == 200
    assert client_http.get(f"{DOMAINES}/{id_domaine}").status_code == 200
    assert client_http.get(FORMATIONS).status_code == 200


def test_obtenir_inconnu_retourne_404(client_http: TestClient) -> None:
    assert client_http.get(f"{DOMAINES}/99999").status_code == 404
    assert client_http.get(f"{FORMATIONS}/99999").status_code == 404


# --- Écritures réservées aux administrateurs ----------------------------------


@pytest.mark.parametrize(
    ("chemin", "corps"),
    [
        (DOMAINES, {"libelle": "Cuisine"}),
        (
            FORMATIONS,
            {
                "titre": "X",
                "duree_heures": 1,
                "prix": "1.00",
                "capacite_max": 1,
                "id_domaine": 1,
            },
        ),
    ],
)
def test_sans_jeton_les_ecritures_sont_refusees(
    client_http: TestClient, chemin: str, corps: dict
) -> None:
    assert client_http.post(chemin, json=corps).status_code == 401


def test_un_jeton_client_ne_permet_pas_d_ecrire(
    client_http: TestClient, entete_client: dict[str, str]
) -> None:
    """401 et non 403 : la revendication `type` ne correspond pas, on ne sait
    donc pas qui appelle."""
    reponse = client_http.post(
        DOMAINES, json={"libelle": "Cuisine"}, headers=entete_client
    )

    assert reponse.status_code == 401


def test_un_salarie_sans_droit_recoit_403(
    client_http: TestClient, entete_agent: dict[str, str]
) -> None:
    """403 et non 401 : le salarié est identifié, il lui manque un droit.

    Le formateur de la fixture le montre bien : administrer le catalogue vient
    de `est_administrateur`, jamais de la fonction exercée.
    """
    reponse = client_http.post(
        DOMAINES, json={"libelle": "Cuisine"}, headers=entete_agent
    )

    assert reponse.status_code == 403


# --- Domaine ------------------------------------------------------------------


def test_libelle_deja_pris_retourne_409(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    reponse = client_http.post(
        DOMAINES, json={"libelle": "Pâtisserie"}, headers=entete_admin
    )

    assert reponse.status_code == 409


def test_libelle_vide_retourne_422(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    assert (
        client_http.post(
            DOMAINES, json={"libelle": ""}, headers=entete_admin
        ).status_code
        == 422
    )


def test_archivage_puis_invisibilite(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    assert (
        client_http.delete(f"{DOMAINES}/{id_domaine}", headers=entete_admin).status_code
        == 204
    )
    assert client_http.get(f"{DOMAINES}/{id_domaine}").status_code == 404


def test_archivage_refuse_si_formations_actives(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    client_http.post(FORMATIONS, json=_formation(id_domaine), headers=entete_admin)

    reponse = client_http.delete(f"{DOMAINES}/{id_domaine}", headers=entete_admin)

    assert reponse.status_code == 409


def test_restauration(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    client_http.delete(f"{DOMAINES}/{id_domaine}", headers=entete_admin)

    reponse = client_http.post(
        f"{DOMAINES}/{id_domaine}/restauration", headers=entete_admin
    )

    assert reponse.status_code == 200
    assert client_http.get(f"{DOMAINES}/{id_domaine}").status_code == 200


def test_restauration_refusee_si_libelle_repris(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    client_http.delete(f"{DOMAINES}/{id_domaine}", headers=entete_admin)
    client_http.post(DOMAINES, json={"libelle": "Pâtisserie"}, headers=entete_admin)

    reponse = client_http.post(
        f"{DOMAINES}/{id_domaine}/restauration", headers=entete_admin
    )

    assert reponse.status_code == 409


# --- Formation ----------------------------------------------------------------


def test_creation_et_lecture(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    creee = client_http.post(
        FORMATIONS, json=_formation(id_domaine), headers=entete_admin
    )

    assert creee.status_code == 201
    assert creee.json()["prix"] == "850000.00"
    assert (
        client_http.get(f"{FORMATIONS}/{creee.json()['id_formation']}").status_code
        == 200
    )


def test_domaine_inconnu_retourne_422(
    client_http: TestClient, entete_admin: dict[str, str]
) -> None:
    """422 et non 404 : l'URL est valide, c'est le corps qui ne l'est pas."""
    reponse = client_http.post(FORMATIONS, json=_formation(99999), headers=entete_admin)

    assert reponse.status_code == 422


@pytest.mark.parametrize(
    "surcharge",
    [
        {"duree_heures": 0},
        {"capacite_max": 0},
        {"prix": "-1.00"},
        {"titre": ""},
    ],
)
def test_bornes_invalides_retournent_422(
    client_http: TestClient,
    entete_admin: dict[str, str],
    id_domaine: int,
    surcharge: dict,
) -> None:
    reponse = client_http.post(
        FORMATIONS, json=_formation(id_domaine, **surcharge), headers=entete_admin
    )

    assert reponse.status_code == 422


def test_filtre_par_domaine(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    client_http.post(FORMATIONS, json=_formation(id_domaine), headers=entete_admin)

    reponse = client_http.get(FORMATIONS, params={"id_domaine": id_domaine})

    assert reponse.status_code == 200
    assert len(reponse.json()) == 1


def test_filtre_sur_un_domaine_inconnu_donne_une_liste_vide(
    client_http: TestClient,
) -> None:
    """Critère de recherche, pas ressource désignée : liste vide, pas 404."""
    reponse = client_http.get(FORMATIONS, params={"id_domaine": 99999})

    assert reponse.status_code == 200
    assert reponse.json() == []


def test_modification_partielle(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    creee = client_http.post(
        FORMATIONS,
        json=_formation(id_domaine, niveau="Débutant"),
        headers=entete_admin,
    ).json()

    reponse = client_http.put(
        f"{FORMATIONS}/{creee['id_formation']}",
        json={"prix": "900000.00"},
        headers=entete_admin,
    )

    assert reponse.status_code == 200
    assert reponse.json()["prix"] == "900000.00"
    assert reponse.json()["niveau"] == "Débutant"


def test_formation_archivage_puis_invisibilite(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    creee = client_http.post(
        FORMATIONS, json=_formation(id_domaine), headers=entete_admin
    ).json()

    assert (
        client_http.delete(
            f"{FORMATIONS}/{creee['id_formation']}", headers=entete_admin
        ).status_code
        == 204
    )
    assert client_http.get(f"{FORMATIONS}/{creee['id_formation']}").status_code == 404


def test_formation_restauration(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    """Route ajoutée par ce chantier — manquait par rapport à `DOMAINES`."""
    creee = client_http.post(
        FORMATIONS, json=_formation(id_domaine), headers=entete_admin
    ).json()
    client_http.delete(f"{FORMATIONS}/{creee['id_formation']}", headers=entete_admin)

    reponse = client_http.post(
        f"{FORMATIONS}/{creee['id_formation']}/restauration", headers=entete_admin
    )

    assert reponse.status_code == 200
    assert client_http.get(f"{FORMATIONS}/{creee['id_formation']}").status_code == 200


def test_formation_restauration_est_idempotente(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    """Aucune unicité ne peut la faire échouer, contrairement à `DOMAINES`."""
    creee = client_http.post(
        FORMATIONS, json=_formation(id_domaine), headers=entete_admin
    ).json()
    client_http.delete(f"{FORMATIONS}/{creee['id_formation']}", headers=entete_admin)
    client_http.post(
        f"{FORMATIONS}/{creee['id_formation']}/restauration", headers=entete_admin
    )

    reponse = client_http.post(
        f"{FORMATIONS}/{creee['id_formation']}/restauration", headers=entete_admin
    )

    assert reponse.status_code == 200


def test_formation_restauration_refuse_un_salarie_sans_droit(
    client_http: TestClient,
    entete_admin: dict[str, str],
    entete_agent: dict[str, str],
    id_domaine: int,
) -> None:
    creee = client_http.post(
        FORMATIONS, json=_formation(id_domaine), headers=entete_admin
    ).json()
    client_http.delete(f"{FORMATIONS}/{creee['id_formation']}", headers=entete_admin)

    reponse = client_http.post(
        f"{FORMATIONS}/{creee['id_formation']}/restauration", headers=entete_agent
    )

    assert reponse.status_code == 403


# --- Listes d'administration (archives comprises) ------------------------------

ADMIN_DOMAINES = f"{DOMAINES}/administration"
ADMIN_FORMATIONS = f"{FORMATIONS}/administration"


@pytest.mark.parametrize("chemin", [ADMIN_DOMAINES, ADMIN_FORMATIONS])
def test_administration_refuse_l_anonyme(client_http: TestClient, chemin: str) -> None:
    assert client_http.get(chemin).status_code == 401


@pytest.mark.parametrize("chemin", [ADMIN_DOMAINES, ADMIN_FORMATIONS])
def test_administration_refuse_un_jeton_client(
    client_http: TestClient, entete_client: dict[str, str], chemin: str
) -> None:
    assert client_http.get(chemin, headers=entete_client).status_code == 401


@pytest.mark.parametrize("chemin", [ADMIN_DOMAINES, ADMIN_FORMATIONS])
def test_administration_refuse_un_salarie_sans_droit(
    client_http: TestClient, entete_agent: dict[str, str], chemin: str
) -> None:
    assert client_http.get(chemin, headers=entete_agent).status_code == 403


@pytest.mark.parametrize("chemin", [ADMIN_DOMAINES, ADMIN_FORMATIONS])
def test_administration_n_est_pas_captee_par_la_route_parametree(
    client_http: TestClient, entete_admin: dict[str, str], chemin: str
) -> None:
    reponse = client_http.get(chemin, headers=entete_admin)

    assert reponse.status_code == 200
    assert reponse.status_code != 422


def test_administration_domaines_montre_les_archives(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    client_http.delete(f"{DOMAINES}/{id_domaine}", headers=entete_admin)

    corps = client_http.get(ADMIN_DOMAINES, headers=entete_admin).json()

    archive = next(d for d in corps if d["id_domaine"] == id_domaine)
    assert archive["supprime_le"] is not None


def test_administration_formations_montre_les_archives(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    creee = client_http.post(
        FORMATIONS, json=_formation(id_domaine), headers=entete_admin
    ).json()
    client_http.delete(f"{FORMATIONS}/{creee['id_formation']}", headers=entete_admin)

    corps = client_http.get(ADMIN_FORMATIONS, headers=entete_admin).json()

    archivee = next(f for f in corps if f["id_formation"] == creee["id_formation"])
    assert archivee["supprime_le"] is not None


def test_administration_formations_montre_aussi_les_actives(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    creee = client_http.post(
        FORMATIONS, json=_formation(id_domaine), headers=entete_admin
    ).json()

    corps = client_http.get(ADMIN_FORMATIONS, headers=entete_admin).json()

    active = next(f for f in corps if f["id_formation"] == creee["id_formation"])
    assert active["supprime_le"] is None


def test_liste_publique_formations_ne_remonte_aucune_archive_ni_le_champ(
    client_http: TestClient, entete_admin: dict[str, str], id_domaine: int
) -> None:
    creee = client_http.post(
        FORMATIONS, json=_formation(id_domaine), headers=entete_admin
    ).json()
    client_http.delete(f"{FORMATIONS}/{creee['id_formation']}", headers=entete_admin)

    publique = client_http.get(FORMATIONS).json()

    assert creee["id_formation"] not in [f["id_formation"] for f in publique]
    assert all("supprime_le" not in f for f in publique)
