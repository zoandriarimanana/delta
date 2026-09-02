"""Tests HTTP des endpoints de commande.

Contre PostgreSQL, pour la même raison que `test_commande_service.py` :
`COMMANDE` référence `RESERVATION`, que SQLite ne sait pas créer.

L'application réelle de `app/main.py` est montée — seule la session est
substituée —, ce qui exerce aussi la traduction globale des erreurs métier.
"""

from collections.abc import Iterator
from datetime import date
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


def _creer_client(db: Session) -> Client:
    compte = Client(
        type_client=TypeClient.PARTICULIER,
        email=f"cmd_{uuid4().hex[:8]}@example.mg",
        mot_de_passe=hacher_mot_de_passe("motdepasse123"),
    )
    db.add(compte)
    db.commit()
    return compte


def _entete(compte: Client) -> dict[str, str]:
    jeton = creer_jeton_acces(compte.id_client, TypeSujet.CLIENT)
    return {"Authorization": f"Bearer {jeton}"}


@pytest.fixture
def compte(db: Session) -> Client:
    return _creer_client(db)


@pytest.fixture
def entete(compte: Client) -> dict[str, str]:
    return _entete(compte)


@pytest.fixture
def eclair(db: Session) -> Produit:
    categorie = CategorieProduit(libelle=f"Cat {uuid4().hex[:6]}")
    db.add(categorie)
    db.flush()
    produit = Produit(
        nom="Éclair",
        prix_unitaire=Decimal("3.50"),
        unite_mesure="piece",
        stock_disponible=10,
        id_categorie=categorie.id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def _corps(id_produit: int, quantite: int = 2) -> dict:
    return {
        "type_commande": "En_ligne",
        "lignes": [{"id_produit": id_produit, "quantite": quantite}],
    }


# --- Protection ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("methode", "chemin"),
    [("post", ""), ("get", ""), ("get", "/1")],
)
def test_endpoints_refuses_sans_jeton(
    client_http: TestClient, methode: str, chemin: str
) -> None:
    reponse = client_http.request(methode, f"{COMMANDES}{chemin}", json={})

    assert reponse.status_code == 401


# --- Création -----------------------------------------------------------------


def test_creation_retourne_201_avec_les_lignes(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    reponse = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit), headers=entete
    )

    assert reponse.status_code == 201
    corps = reponse.json()
    assert corps["statut"] == "En_attente"
    assert Decimal(corps["montant_total"]) == Decimal("7.00")
    assert corps["lignes"][0]["nom_produit"] == "Éclair"
    assert Decimal(corps["lignes"][0]["prix_unitaire_applique"]) == Decimal("3.50")


def test_montant_envoye_par_le_client_est_ignore(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    """Le champ n'existe pas au schema d'entrée : l'envoyer n'a aucun effet."""
    reponse = client_http.post(
        COMMANDES,
        json={**_corps(eclair.id_produit), "montant_total": "0.01", "statut": "Livree"},
        headers=entete,
    )

    corps = reponse.json()
    assert Decimal(corps["montant_total"]) == Decimal("7.00")
    assert corps["statut"] == "En_attente"


def test_produit_inexistant_retourne_422(
    client_http: TestClient, entete: dict[str, str]
) -> None:
    reponse = client_http.post(COMMANDES, json=_corps(99999), headers=entete)

    assert reponse.status_code == 422


def test_stock_insuffisant_retourne_409(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    reponse = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit, quantite=99), headers=entete
    )

    assert reponse.status_code == 409
    assert "Stock insuffisant" in reponse.json()["detail"]
    assert "SQL" not in reponse.text


@pytest.mark.parametrize(
    "corps_invalide",
    [
        {"type_commande": "En_ligne", "lignes": []},
        {"type_commande": "Inconnu", "lignes": [{"id_produit": 1, "quantite": 1}]},
        {"type_commande": "En_ligne", "lignes": [{"id_produit": 1, "quantite": 0}]},
    ],
)
def test_corps_invalide_retourne_422(
    client_http: TestClient, entete: dict[str, str], corps_invalide: dict
) -> None:
    reponse = client_http.post(COMMANDES, json=corps_invalide, headers=entete)

    assert reponse.status_code == 422


# --- Isolation entre clients ---------------------------------------------------


def test_historique_ne_montre_que_ses_propres_commandes(
    client_http: TestClient, db: Session, entete: dict[str, str], eclair: Produit
) -> None:
    client_http.post(COMMANDES, json=_corps(eclair.id_produit), headers=entete)
    autre = _creer_client(db)
    client_http.post(COMMANDES, json=_corps(eclair.id_produit), headers=_entete(autre))

    a_moi = client_http.get(COMMANDES, headers=entete).json()
    a_lui = client_http.get(COMMANDES, headers=_entete(autre)).json()

    assert len(a_moi) == 1
    assert len(a_lui) == 1
    assert a_moi[0]["id_commande"] != a_lui[0]["id_commande"]


def test_commande_dautrui_retourne_404_et_non_403(
    client_http: TestClient, db: Session, entete: dict[str, str], eclair: Produit
) -> None:
    """404 délibérément : un 403 confirmerait que la commande existe.

    C'est le critère central de l'issue #16, vérifié dès maintenant puisque
    l'endpoint est livré ici.
    """
    sienne = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit), headers=entete
    ).json()
    autre = _creer_client(db)

    reponse = client_http.get(
        f"{COMMANDES}/{sienne['id_commande']}", headers=_entete(autre)
    )

    assert reponse.status_code == 404


def test_lecture_de_sa_propre_commande(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    creee = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit), headers=entete
    ).json()

    reponse = client_http.get(f"{COMMANDES}/{creee['id_commande']}", headers=entete)

    assert reponse.status_code == 200
    assert reponse.json()["id_commande"] == creee["id_commande"]


# --- Parcours invité ----------------------------------------------------------

INVITE = {"nom_invite": "Rakoto Jean", "contact_invite": "+261340000000"}


def _corps_invite(id_produit: int, quantite: int = 2) -> dict:
    return {**_corps(id_produit, quantite), **INVITE}


def test_commande_invitee_sans_jeton_retourne_201(
    client_http: TestClient, eclair: Produit
) -> None:
    """Le parcours invité est public : c'est sa raison d'être."""
    reponse = client_http.post(
        f"{COMMANDES}/invite", json=_corps_invite(eclair.id_produit)
    )

    assert reponse.status_code == 201
    corps = reponse.json()
    assert corps["id_client"] is None
    assert corps["nom_invite"] == "Rakoto Jean"
    assert corps["reference_publique"] is not None


def test_la_reference_est_rendue_a_la_validation(
    client_http: TestClient, eclair: Produit
) -> None:
    """Sans elle, l'invité perd définitivement l'accès à sa commande.

    C'est ce qui impose à l'interface de la lui présenter (issue #15).
    """
    corps = client_http.post(
        f"{COMMANDES}/invite", json=_corps_invite(eclair.id_produit)
    ).json()

    relue = client_http.get(f"{COMMANDES}/invite/{corps['reference_publique']}")

    assert relue.status_code == 200
    assert relue.json()["id_commande"] == corps["id_commande"]


def test_lecture_par_reference_est_publique(
    client_http: TestClient, eclair: Produit
) -> None:
    """Aucun en-tête d'authentification : l'invité n'en a pas."""
    corps = client_http.post(
        f"{COMMANDES}/invite", json=_corps_invite(eclair.id_produit)
    ).json()

    reponse = client_http.get(f"{COMMANDES}/invite/{corps['reference_publique']}")

    assert reponse.status_code == 200


def test_reference_inconnue_retourne_404(client_http: TestClient) -> None:
    assert client_http.get(f"{COMMANDES}/invite/{uuid4()}").status_code == 404


def test_reference_malformee_retourne_422(client_http: TestClient) -> None:
    """Le type de la route rejette avant d'atteindre la base."""
    assert client_http.get(f"{COMMANDES}/invite/pas-un-uuid").status_code == 422


def test_commande_invitee_absente_de_l_historique(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    client_http.post(f"{COMMANDES}/invite", json=_corps_invite(eclair.id_produit))

    assert client_http.get(COMMANDES, headers=entete).json() == []


def test_commande_invitee_illisible_par_son_identifiant(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    """L'identifiant séquentiel ne doit pas ouvrir une commande invitée.

    Sans quoi la référence UUID ne servirait à rien : il suffirait d'essayer les
    identifiants à la suite.
    """
    corps = client_http.post(
        f"{COMMANDES}/invite", json=_corps_invite(eclair.id_produit)
    ).json()

    reponse = client_http.get(f"{COMMANDES}/{corps['id_commande']}", headers=entete)

    assert reponse.status_code == 404


@pytest.mark.parametrize("champ_manquant", ["nom_invite", "contact_invite"])
def test_identite_invite_incomplete_retourne_422(
    client_http: TestClient, eclair: Produit, champ_manquant: str
) -> None:
    corps = _corps_invite(eclair.id_produit)
    del corps[champ_manquant]

    assert client_http.post(f"{COMMANDES}/invite", json=corps).status_code == 422


def test_un_jeton_expire_ne_bascule_pas_en_mode_invite(
    client_http: TestClient, eclair: Produit
) -> None:
    """Le point central du choix de deux chemins distincts.

    Sur l'endpoint authentifié, un jeton invalide doit donner 401 — jamais une
    commande anonyme que le client ne retrouverait pas dans son historique.
    """
    reponse = client_http.post(
        COMMANDES,
        json=_corps(eclair.id_produit),
        headers={"Authorization": "Bearer jeton.invalide"},
    )

    assert reponse.status_code == 401


# --- Personnalisation ----------------------------------------------------------


@pytest.fixture
def gateau(db: Session, eclair: Produit) -> Produit:
    produit = Produit(
        nom="Gâteau d'anniversaire",
        prix_unitaire=Decimal("25.00"),
        unite_mesure="piece",
        stock_disponible=10,
        est_personnalisable=True,
        supplement_personnalisation=Decimal("4.00"),
        id_categorie=eclair.id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def _corps_personnalise(id_produit: int) -> dict:
    return {
        "type_commande": "En_ligne",
        "lignes": [
            {
                "id_produit": id_produit,
                "quantite": 1,
                "personnalisation": {
                    "description_demande": "Écrire « Joyeux anniversaire »",
                    "ingredients_specifiques": "Sans fruits à coque",
                },
            }
        ],
    }


def test_personnalisation_retournee_dans_la_ligne(
    client_http: TestClient, entete: dict[str, str], gateau: Produit
) -> None:
    """Lisible sans second appel : la demande fait partie de la commande."""
    reponse = client_http.post(
        COMMANDES, json=_corps_personnalise(gateau.id_produit), headers=entete
    )

    assert reponse.status_code == 201
    demande = reponse.json()["lignes"][0]["personnalisation"]
    assert demande["description_demande"] == "Écrire « Joyeux anniversaire »"
    assert demande["id_produit_base"] == gateau.id_produit


def test_ligne_ordinaire_porte_une_personnalisation_nulle(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    reponse = client_http.post(
        COMMANDES, json=_corps(eclair.id_produit), headers=entete
    )

    assert reponse.json()["lignes"][0]["personnalisation"] is None


def test_produit_non_personnalisable_retourne_422(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    """422 et non 409 : le produit existe, c'est la combinaison qui est invalide."""
    reponse = client_http.post(
        COMMANDES, json=_corps_personnalise(eclair.id_produit), headers=entete
    )

    assert reponse.status_code == 422
    assert "personnalisation" in reponse.json()["detail"].lower()


def test_supplement_envoye_par_le_client_est_ignore(
    client_http: TestClient, entete: dict[str, str], gateau: Produit
) -> None:
    """Sinon il suffirait d'envoyer `0` pour une personnalisation gratuite.

    Le tarif retenu est celui du catalogue (4.00), pas celui de la requête.
    """
    corps = _corps_personnalise(gateau.id_produit)
    corps["lignes"][0]["personnalisation"]["supplement_prix"] = "-999.00"

    reponse = client_http.post(COMMANDES, json=corps, headers=entete)

    assert reponse.status_code == 201
    assert reponse.json()["lignes"][0]["personnalisation"]["supplement_prix"] == "4.00"
    assert reponse.json()["montant_total"] == "29.00"  # 25.00 + 4.00


def test_produit_base_envoye_par_le_client_est_ignore(
    client_http: TestClient, entete: dict[str, str], gateau: Produit, eclair: Produit
) -> None:
    """Déduit de la ligne : aucune incohérence n'est représentable."""
    corps = _corps_personnalise(gateau.id_produit)
    corps["lignes"][0]["personnalisation"]["id_produit_base"] = eclair.id_produit

    reponse = client_http.post(COMMANDES, json=corps, headers=entete)

    assert reponse.json()["lignes"][0]["personnalisation"]["id_produit_base"] == (
        gateau.id_produit
    )


def test_personnalisation_possible_en_mode_invite(
    client_http: TestClient, gateau: Produit
) -> None:
    """Le parcours invité n'est pas un parcours au rabais."""
    corps = {
        **_corps_personnalise(gateau.id_produit),
        "type_commande": "A_emporter",
        "nom_invite": "Rakoto Jean",
        "contact_invite": "+261340000000",
    }

    reponse = client_http.post(f"{COMMANDES}/invite", json=corps)

    assert reponse.status_code == 201
    assert reponse.json()["lignes"][0]["personnalisation"] is not None


def test_aucun_endpoint_de_personnalisation_n_est_expose(
    client_http: TestClient, entete: dict[str, str], gateau: Produit
) -> None:
    """Limite assumée du sprint 3 : pas de modification a posteriori.

    `montant_total` est figé à la création ; permettre d'ajouter un supplément
    ensuite le rendrait faux, ou obligerait à recalculer une donnée d'archive.
    """
    reponse = client_http.post(
        COMMANDES, json=_corps_personnalise(gateau.id_produit), headers=entete
    )
    id_ligne = reponse.json()["lignes"][0]["id_ligne"]

    for methode, chemin in (
        ("post", f"{settings.API_V1_PREFIX}/personnalisations"),
        ("put", f"{settings.API_V1_PREFIX}/personnalisations/{id_ligne}"),
        ("patch", f"{COMMANDES}/lignes/{id_ligne}/personnalisation"),
    ):
        assert (
            getattr(client_http, methode)(
                chemin, json={"description_demande": "Modifiée"}, headers=entete
            ).status_code
            == 404
        )


# --- Prise de commande par le personnel (#80) ---------------------------------

COMMANDES_PERSONNEL = f"{COMMANDES}/personnel"


def _salarie_connecte(db: Session, avec_mot_de_passe: bool = True) -> dict[str, str]:
    agent = Personnel(
        nom="Rakoto",
        prenom="Hery",
        fonction=FonctionPersonnel.RECEPTIONNISTE,
        email=f"agent_{uuid4().hex[:8]}@delta.mg",
        date_embauche=date(2024, 1, 1),
        mot_de_passe=(
            hacher_mot_de_passe("motdepasse123") if avec_mot_de_passe else None
        ),
    )
    db.add(agent)
    db.commit()
    jeton = creer_jeton_acces(agent.id_personnel, TypeSujet.PERSONNEL)
    return {"Authorization": f"Bearer {jeton}"}


def _corps_personnel(id_produit: int, **extra: object) -> dict:
    return {
        "type_commande": "Sur_place",
        "lignes": [{"id_produit": id_produit, "quantite": 1}],
        **extra,
    }


def test_prise_de_commande_sans_jeton_retourne_401(
    client_http: TestClient, eclair: Produit
) -> None:
    reponse = client_http.post(
        COMMANDES_PERSONNEL,
        json=_corps_personnel(
            eclair.id_produit, nom_invite="Jean", contact_invite="03"
        ),
    )

    assert reponse.status_code == 401


def test_prise_de_commande_avec_jeton_client_retourne_401(
    client_http: TestClient, entete: dict[str, str], eclair: Produit
) -> None:
    """Le cloisonnement des deux populations tient jusqu'ici.

    `CLIENT` et `PERSONNEL` ont des clés primaires qui se recouvrent : sans la
    revendication `type`, ce jeton passerait pour celui d'un salarié.
    """
    reponse = client_http.post(
        COMMANDES_PERSONNEL,
        json=_corps_personnel(
            eclair.id_produit, nom_invite="Jean", contact_invite="03"
        ),
        headers=entete,
    )

    assert reponse.status_code == 401


def test_un_salarie_sans_mot_de_passe_est_refuse(
    client_http: TestClient, db: Session, eclair: Produit
) -> None:
    """`mot_de_passe` nul signifie « pas de compte de connexion », pas « mot de
    passe vide » : la dépendance le refuse."""
    entete_agent = _salarie_connecte(db, avec_mot_de_passe=False)

    reponse = client_http.post(
        COMMANDES_PERSONNEL,
        json=_corps_personnel(
            eclair.id_produit, nom_invite="Jean", contact_invite="03"
        ),
        headers=entete_agent,
    )

    assert reponse.status_code == 401


def test_prise_de_commande_pour_un_invite_retourne_201(
    client_http: TestClient, db: Session, eclair: Produit
) -> None:
    """Contrôle positif : sans lui, une garde refusant tout passerait les trois
    tests ci-dessus."""
    entete_agent = _salarie_connecte(db)

    reponse = client_http.post(
        COMMANDES_PERSONNEL,
        json=_corps_personnel(
            eclair.id_produit, nom_invite="Jean", contact_invite="0340000000"
        ),
        headers=entete_agent,
    )

    assert reponse.status_code == 201
    corps = reponse.json()
    assert corps["id_client"] is None
    assert corps["reference_publique"] is not None


def test_les_deux_chemins_ensemble_retournent_422(
    client_http: TestClient, db: Session, eclair: Produit
) -> None:
    entete_agent = _salarie_connecte(db)

    reponse = client_http.post(
        COMMANDES_PERSONNEL,
        json=_corps_personnel(
            eclair.id_produit,
            id_reservation=1,
            nom_invite="Jean",
            contact_invite="03",
        ),
        headers=entete_agent,
    )

    assert reponse.status_code == 422
