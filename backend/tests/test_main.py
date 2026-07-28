"""Tests de l'assemblage de l'application.

Vérifie ce dont `main.py` est responsable — montage des routers sous le préfixe
d'API, CORS, traduction globale des erreurs métier — sans toucher à la base :
aucun de ces tests n'atteint un endpoint qui écrit.
"""

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.exceptions import AuthentificationInvalide, ConflitMetier, ErreurMetier
from app.main import app

ORIGINE_AUTORISEE = "http://localhost:5173"


@pytest.fixture
def client_http() -> TestClient:
    return TestClient(app)


def test_routes_montees_sous_le_prefixe_d_api() -> None:
    """Toutes les routes exposées, sous le préfixe configuré, et rien d'autre.

    Le schéma OpenAPI sert de source : c'est le contrat public de l'API, et il
    ne dépend pas de la façon dont FastAPI structure `app.routes` en interne.
    Ce test échoue dès qu'un endpoint est ajouté sans être acté ici — y compris
    un endpoint exposé par mégarde.
    """
    prefixe = settings.API_V1_PREFIX

    assert set(app.openapi()["paths"]) == {
        f"{prefixe}/auth/inscription",
        f"{prefixe}/auth/inscription-entreprise",
        f"{prefixe}/auth/connexion",
        f"{prefixe}/categories-produit",
        f"{prefixe}/categories-produit/{{id_categorie}}",
        f"{prefixe}/produits",
        f"{prefixe}/produits/{{id_produit}}",
        f"{prefixe}/commandes",
        f"{prefixe}/commandes/{{id_commande}}",
        f"{prefixe}/commandes/invite",
        f"{prefixe}/commandes/invite/{{reference_publique}}",
    }


@pytest.mark.parametrize(
    "classe_erreur",
    [AuthentificationInvalide, ConflitMetier, ErreurMetier],
)
def test_erreurs_metier_ont_un_gestionnaire_global(
    classe_erreur: type[Exception],
) -> None:
    """La traduction est centralisée : aucun router n'a à la refaire."""
    assert classe_erreur in app.exception_handlers


@pytest.mark.parametrize(
    ("classe_erreur", "statut_attendu"),
    [
        (AuthentificationInvalide, 401),
        (ConflitMetier, 409),
        (ErreurMetier, 400),
    ],
)
def test_chaque_erreur_metier_donne_son_code_http(
    classe_erreur: type[Exception], statut_attendu: int
) -> None:
    gestionnaire = app.exception_handlers[classe_erreur]

    reponse = asyncio.run(gestionnaire(None, classe_erreur("message métier")))

    assert reponse.status_code == statut_attendu


def test_reponse_d_erreur_ne_contient_que_le_message_metier() -> None:
    """Le corps se limite à `detail` : aucune trace SQL ni nom de contrainte."""
    gestionnaire = app.exception_handlers[ErreurMetier]

    reponse = asyncio.run(gestionnaire(None, ErreurMetier("message métier")))

    assert json.loads(reponse.body) == {"detail": "message métier"}


def test_cors_autorise_l_origine_du_frontend(client_http: TestClient) -> None:
    reponse = client_http.options(
        f"{settings.API_V1_PREFIX}/auth/connexion",
        headers={
            "Origin": ORIGINE_AUTORISEE,
            "Access-Control-Request-Method": "POST",
        },
    )

    assert reponse.headers["access-control-allow-origin"] == ORIGINE_AUTORISEE


def test_cors_refuse_une_origine_inconnue(client_http: TestClient) -> None:
    """Pas de joker : une origine non listée n'obtient pas l'en-tête."""
    reponse = client_http.options(
        f"{settings.API_V1_PREFIX}/auth/connexion",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert "access-control-allow-origin" not in reponse.headers
