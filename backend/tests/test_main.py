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
        f"{prefixe}/auth/personnel/connexion",
        f"{prefixe}/categories-produit",
        f"{prefixe}/categories-produit/{{id_categorie}}",
        f"{prefixe}/produits",
        f"{prefixe}/produits/{{id_produit}}",
        f"{prefixe}/produits/administration",
        f"{prefixe}/categories-produit/administration",
        f"{prefixe}/produits/{{id_produit}}/restauration",
        f"{prefixe}/categories-produit/{{id_categorie}}/restauration",
        f"{prefixe}/commandes",
        f"{prefixe}/commandes/{{id_commande}}",
        f"{prefixe}/commandes/invite",
        f"{prefixe}/commandes/personnel",
        f"{prefixe}/commandes/invite/{{reference_publique}}",
        f"{prefixe}/commandes/invite/{{reference_publique}}/livraison",
        f"{prefixe}/commandes/{{id_commande}}/livraison",
        f"{prefixe}/domaines-formation",
        f"{prefixe}/domaines-formation/{{id_domaine}}",
        f"{prefixe}/domaines-formation/{{id_domaine}}/restauration",
        f"{prefixe}/formations",
        f"{prefixe}/formations/{{id_formation}}",
        f"{prefixe}/sessions-formation",
        f"{prefixe}/sessions-formation/{{id_session}}",
        f"{prefixe}/sessions-formation/{{id_session}}/formateur",
        f"{prefixe}/sessions-formation/{{id_session}}/statut",
        f"{prefixe}/logements",
        f"{prefixe}/logements/{{id_logement}}",
        f"{prefixe}/logements/{{id_logement}}/restauration",
        f"{prefixe}/salles",
        f"{prefixe}/salles/{{id_salle}}",
        f"{prefixe}/salles/{{id_salle}}/restauration",
        f"{prefixe}/reservations",
        f"{prefixe}/reservations/{{id_reservation}}",
        f"{prefixe}/reservations/{{id_reservation}}/statut",
        f"{prefixe}/livraisons",
        f"{prefixe}/livraisons/{{id_livraison}}",
        f"{prefixe}/livraisons/{{id_livraison}}/livreur",
        f"{prefixe}/livraisons/{{id_livraison}}/planification",
        f"{prefixe}/livraisons/{{id_livraison}}/statut",
        f"{prefixe}/personnel",
        f"{prefixe}/personnel/{{id_personnel}}",
        f"{prefixe}/personnel/{{id_personnel}}/restauration",
        f"{prefixe}/abonnements",
        f"{prefixe}/abonnements/{{id_abonnement}}",
        f"{prefixe}/abonnements/administration",
        f"{prefixe}/abonnements/administration/{{id_abonnement}}",
        f"{prefixe}/beneficiaires",
        f"{prefixe}/beneficiaires/{{id_beneficiaire}}",
        f"{prefixe}/beneficiaires/administration",
        f"{prefixe}/beneficiaires/administration/{{id_beneficiaire}}",
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
