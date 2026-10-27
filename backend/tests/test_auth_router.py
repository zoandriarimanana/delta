"""Tests des endpoints d'authentification, montés sur l'application réelle.

L'application de `app/main.py` est utilisée telle quelle — seule la session base
est substituée. C'est délibéré : la traduction des erreurs métier en codes HTTP
vit désormais dans les gestionnaires globaux de `main.py`, donc un test qui
monterait un `FastAPI()` nu ne vérifierait plus les 409 et 401. Le préfixe
d'API est lui aussi exercé au passage.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.cookies import NOM_COOKIE_CSRF, NOM_COOKIE_SESSION
from app.core.database import Base, get_db
from app.core.rate_limit import limiter
from app.core.security import decoder_jeton_acces
from app.main import app
from app.models.client import Client
from app.models.client_entreprise import ClientEntreprise
from app.models.client_particulier import ClientParticulier
from tests.conftest import BoiteMail

AUTH = f"{settings.API_V1_PREFIX}/auth"

INSCRIPTION = {
    "email": "jean@example.mg",
    "mot_de_passe": "motdepasse123",
    "telephone": "+261340000000",
    "identite": {"nom": "Rakoto", "prenom": "Jean"},
}


@pytest.fixture
def client_http() -> Iterator[TestClient]:
    # SQLite en mémoire crée une base distincte par connexion, et TestClient
    # exécute les endpoints synchrones dans un thread séparé : sans StaticPool
    # (une seule connexion partagée) la requête HTTP tomberait sur une base
    # vide. `check_same_thread` doit suivre, sqlite3 interdisant par défaut le
    # partage d'une connexion entre threads.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # `client_entreprise` est necessaire bien qu'aucun test ici ne la peuple :
    # `ClientRead` expose desormais la relation `entreprise`, donc sa
    # serialisation interroge la table a chaque reponse.
    Base.metadata.create_all(
        engine,
        tables=[
            Client.__table__,
            ClientParticulier.__table__,
            ClientEntreprise.__table__,
        ],
    )

    def _get_db() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as testeur:
            yield testeur
    finally:
        # `app` est un singleton de module : sans nettoyage, la substitution
        # fuiterait sur les tests suivants.
        app.dependency_overrides.clear()


def test_inscription_retourne_201_et_le_client(client_http: TestClient) -> None:
    reponse = client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    assert reponse.status_code == 201
    corps = reponse.json()
    assert corps["email"] == "jean@example.mg"
    assert corps["type_client"] == "Particulier"
    assert corps["particulier"]["nom"] == "Rakoto"


def test_inscription_n_expose_jamais_le_mot_de_passe(client_http: TestClient) -> None:
    """Le hash ne doit apparaître sous aucune clé de la réponse."""
    corps = client_http.post(f"{AUTH}/inscription", json=INSCRIPTION).json()

    assert "mot_de_passe" not in corps
    assert "$2b$" not in str(corps)


def test_inscription_en_double_retourne_409(client_http: TestClient) -> None:
    """Vérifie le gestionnaire global `ConflitMetier` → 409."""
    client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    reponse = client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    assert reponse.status_code == 409
    assert "déjà utilisé" in reponse.json()["detail"]


def test_inscription_email_invalide_retourne_422(client_http: TestClient) -> None:
    reponse = client_http.post(
        f"{AUTH}/inscription", json={**INSCRIPTION, "email": "pas-un-email"}
    )

    assert reponse.status_code == 422


def test_inscription_mot_de_passe_trop_court_retourne_422(
    client_http: TestClient,
) -> None:
    reponse = client_http.post(
        f"{AUTH}/inscription", json={**INSCRIPTION, "mot_de_passe": "court"}
    )

    assert reponse.status_code == 422


def test_inscription_mot_de_passe_trop_long_en_octets_retourne_422(
    client_http: TestClient,
) -> None:
    """40 lettres accentuées = 80 octets : rejeté avant d'atteindre bcrypt."""
    reponse = client_http.post(
        f"{AUTH}/inscription", json={**INSCRIPTION, "mot_de_passe": "é" * 40}
    )

    assert reponse.status_code == 422


def _verifier(client_http: TestClient, courriels: BoiteMail, email: str) -> None:
    """Saisit le code reçu par e-mail, comme le client le ferait."""
    reponse = client_http.post(
        f"{AUTH}/verification",
        json={"email": email, "code": courriels.code_pour(email)},
    )
    assert reponse.status_code == 204, reponse.text


def test_connexion_retourne_un_jeton_exploitable(
    client_http: TestClient, courriels: BoiteMail
) -> None:
    """Depuis T0.10, le jeton est posé en cookie `httpOnly`, plus dans le corps.

    Le corps ne confirme plus que la population ouverte ; le jeton lui-même
    se lit dans le cookie que la réponse pose, exactement comme le
    navigateur le ferait.
    """
    inscrit = client_http.post(f"{AUTH}/inscription", json=INSCRIPTION).json()
    _verifier(client_http, courriels, INSCRIPTION["email"])

    reponse = client_http.post(
        f"{AUTH}/connexion",
        json={
            "email": INSCRIPTION["email"],
            "mot_de_passe": INSCRIPTION["mot_de_passe"],
        },
    )

    assert reponse.status_code == 200
    # `est_administrateur` reste `None` : la notion n'existe pas pour un
    # CLIENT — voir `SessionActive`.
    assert reponse.json() == {"type": "client", "est_administrateur": None}
    assert NOM_COOKIE_CSRF in reponse.cookies
    charge_utile = decoder_jeton_acces(reponse.cookies[NOM_COOKIE_SESSION])
    assert charge_utile is not None
    assert charge_utile["sub"] == str(inscrit["id_client"])


def test_connexion_mauvais_mot_de_passe_retourne_401(client_http: TestClient) -> None:
    """Vérifie le gestionnaire global `AuthentificationInvalide` → 401 + en-tête."""
    client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    reponse = client_http.post(
        f"{AUTH}/connexion",
        json={"email": INSCRIPTION["email"], "mot_de_passe": "mauvais_mot_de_passe"},
    )

    assert reponse.status_code == 401
    assert reponse.headers["WWW-Authenticate"] == "Bearer"


def test_connexion_email_inconnu_retourne_401_avec_le_meme_message(
    client_http: TestClient,
) -> None:
    """Message identique aux deux causes de rejet : pas d'énumération de comptes."""
    client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    inconnu = client_http.post(
        f"{AUTH}/connexion",
        json={"email": "inconnu@example.mg", "mot_de_passe": "motdepasse123"},
    )
    mauvais = client_http.post(
        f"{AUTH}/connexion",
        json={"email": INSCRIPTION["email"], "mot_de_passe": "mauvais_mot_de_passe"},
    )

    assert inconnu.status_code == mauvais.status_code == 401
    assert inconnu.json()["detail"] == mauvais.json()["detail"]


# --- Inscription entreprise ---------------------------------------------------

INSCRIPTION_ENTREPRISE = {
    "email": "contact@societe.mg",
    "mot_de_passe": "motdepasse123",
    "identite": {
        "raison_sociale": "Société Delta",
        "numero_id_fiscal": "1234567890",
        "secteur_activite": "Restauration",
    },
}


def test_inscription_entreprise_retourne_201(client_http: TestClient) -> None:
    reponse = client_http.post(
        f"{AUTH}/inscription-entreprise", json=INSCRIPTION_ENTREPRISE
    )

    assert reponse.status_code == 201
    corps = reponse.json()
    assert corps["type_client"] == "Entreprise"
    assert corps["entreprise"]["raison_sociale"] == "Société Delta"
    assert corps["particulier"] is None


def test_inscription_entreprise_n_expose_pas_le_mot_de_passe(
    client_http: TestClient,
) -> None:
    corps = client_http.post(
        f"{AUTH}/inscription-entreprise", json=INSCRIPTION_ENTREPRISE
    ).json()

    assert "mot_de_passe" not in corps
    assert "$2b$" not in str(corps)


def test_email_en_double_retourne_409(client_http: TestClient) -> None:
    client_http.post(f"{AUTH}/inscription-entreprise", json=INSCRIPTION_ENTREPRISE)

    reponse = client_http.post(
        f"{AUTH}/inscription-entreprise",
        json={
            **INSCRIPTION_ENTREPRISE,
            "identite": {
                **INSCRIPTION_ENTREPRISE["identite"],
                "numero_id_fiscal": "9999",
            },
        },
    )

    assert reponse.status_code == 409
    assert "e-mail" in reponse.json()["detail"]


def test_numero_fiscal_en_double_retourne_409_avec_son_propre_message(
    client_http: TestClient,
) -> None:
    """Les deux conflits doivent être distinguables par le client de l'API."""
    client_http.post(f"{AUTH}/inscription-entreprise", json=INSCRIPTION_ENTREPRISE)

    reponse = client_http.post(
        f"{AUTH}/inscription-entreprise",
        json={**INSCRIPTION_ENTREPRISE, "email": "autre@societe.mg"},
    )

    assert reponse.status_code == 409
    assert "fiscale" in reponse.json()["detail"]


def test_entreprise_se_connecte_sur_le_meme_endpoint(
    client_http: TestClient, courriels: BoiteMail
) -> None:
    """La connexion n'a pas été dupliquée : elle porte sur CLIENT."""
    inscrit = client_http.post(
        f"{AUTH}/inscription-entreprise", json=INSCRIPTION_ENTREPRISE
    ).json()
    _verifier(client_http, courriels, INSCRIPTION_ENTREPRISE["email"])

    reponse = client_http.post(
        f"{AUTH}/connexion",
        json={
            "email": INSCRIPTION_ENTREPRISE["email"],
            "mot_de_passe": INSCRIPTION_ENTREPRISE["mot_de_passe"],
        },
    )

    assert reponse.status_code == 200
    charge = decoder_jeton_acces(reponse.cookies[NOM_COOKIE_SESSION])
    assert charge is not None
    assert charge["sub"] == str(inscrit["id_client"])


@pytest.mark.parametrize("champ_manquant", ["raison_sociale", "numero_id_fiscal"])
def test_champs_obligatoires_manquants_retournent_422(
    client_http: TestClient, champ_manquant: str
) -> None:
    identite = {
        k: v
        for k, v in INSCRIPTION_ENTREPRISE["identite"].items()
        if k != champ_manquant
    }

    reponse = client_http.post(
        f"{AUTH}/inscription-entreprise",
        json={**INSCRIPTION_ENTREPRISE, "identite": identite},
    )

    assert reponse.status_code == 422


# --- Vérification de l'adresse e-mail (14 octobre 2026) -------------------


def _connexion(client_http: TestClient):
    return client_http.post(
        f"{AUTH}/connexion",
        json={
            "email": INSCRIPTION["email"],
            "mot_de_passe": INSCRIPTION["mot_de_passe"],
        },
    )


def test_un_compte_inscrit_ne_se_connecte_qu_une_fois_verifie(
    client_http: TestClient, courriels: BoiteMail
) -> None:
    client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    refus = _connexion(client_http)
    assert refus.status_code == 403
    assert "confirm" in refus.json()["detail"]
    assert courriels[-1][0] == INSCRIPTION["email"]

    _verifier(client_http, courriels, INSCRIPTION["email"])
    assert _connexion(client_http).status_code == 200


def test_un_mauvais_mot_de_passe_ne_revele_pas_le_compte_non_verifie(
    client_http: TestClient,
) -> None:
    client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    reponse = client_http.post(
        f"{AUTH}/connexion",
        json={"email": INSCRIPTION["email"], "mot_de_passe": "Faux-Mot2Passe!"},
    )

    assert reponse.status_code == 401


def test_un_code_faux_est_refuse_comme_une_adresse_inconnue(
    client_http: TestClient, courriels: BoiteMail
) -> None:
    client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)
    bon = courriels.code_pour(INSCRIPTION["email"])
    faux = "000000" if bon != "000000" else "111111"

    mauvais = client_http.post(
        f"{AUTH}/verification", json={"email": INSCRIPTION["email"], "code": faux}
    )
    inconnu = client_http.post(
        f"{AUTH}/verification", json={"email": "personne@example.mg", "code": bon}
    )

    assert mauvais.status_code == inconnu.status_code == 422
    assert mauvais.json()["detail"] == inconnu.json()["detail"]


def test_le_code_est_invalide_apres_cinq_erreurs(
    client_http: TestClient, courriels: BoiteMail
) -> None:
    client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)
    bon = courriels.code_pour(INSCRIPTION["email"])
    faux = "000000" if bon != "000000" else "111111"
    for _ in range(5):
        client_http.post(
            f"{AUTH}/verification", json={"email": INSCRIPTION["email"], "code": faux}
        )
    # La limite de débit (5/minute) bloquerait la tentative suivante en 429 :
    # on la lève pour vérifier la règle des cinq essais elle-même.
    limiter.reset()

    reponse = client_http.post(
        f"{AUTH}/verification", json={"email": INSCRIPTION["email"], "code": bon}
    )

    assert reponse.status_code == 422


def test_le_renvoi_donne_un_nouveau_code_et_ne_trahit_aucun_compte(
    client_http: TestClient, courriels: BoiteMail
) -> None:
    client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)
    nombre = len(courriels)

    renvoi = client_http.post(
        f"{AUTH}/verification/renvoi", json={"email": INSCRIPTION["email"]}
    )
    inconnu = client_http.post(
        f"{AUTH}/verification/renvoi", json={"email": "personne@example.mg"}
    )

    assert renvoi.status_code == inconnu.status_code == 202
    assert len(courriels) == nombre + 1
    _verifier(client_http, courriels, INSCRIPTION["email"])


def test_le_code_n_est_jamais_stocke_en_clair(
    client_http: TestClient, courriels: BoiteMail
) -> None:
    inscrit = client_http.post(f"{AUTH}/inscription", json=INSCRIPTION).json()
    code = courriels.code_pour(INSCRIPTION["email"])

    db = next(app.dependency_overrides[get_db]())
    client = db.get(Client, inscrit["id_client"])

    assert client is not None
    assert client.code_verification is not None
    assert code not in client.code_verification


def test_en_developpement_un_envoi_refuse_ecrit_le_code_au_journal(
    client_http: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Serveur configuré mais qui refuse (mot de passe d'application révoqué,
    par exemple) : en développement, le code reste lisible pour tester."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "developpement")
    monkeypatch.setattr(
        "app.services.verification_email_service.envoyer_courriel",
        lambda *args: False,
    )

    with caplog.at_level("WARNING"):
        client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    assert any(
        "Code de vérification" in r.getMessage()
        and INSCRIPTION["email"] in r.getMessage()
        for r in caplog.records
    )


def test_en_production_le_code_n_est_jamais_ecrit_au_journal(
    client_http: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(
        "app.services.verification_email_service.envoyer_courriel",
        lambda *args: False,
    )

    with caplog.at_level("WARNING"):
        client_http.post(f"{AUTH}/inscription", json=INSCRIPTION)

    assert not any("Code de vérification" in r.getMessage() for r in caplog.records)
