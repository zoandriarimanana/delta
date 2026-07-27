"""Tests du service PRODUIT."""

from collections.abc import Iterator
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import ReferenceInvalide, RessourceIntrouvable
from app.models.categorie_produit import CategorieProduit
from app.models.produit import Produit
from app.schemas.categorie_produit import CategorieProduitCreate
from app.schemas.produit import ProduitCreate, ProduitUpdate
from app.services.categorie_produit_service import CategorieProduitService
from app.services.produit_service import (
    CONTRAINTE_PRODUIT_CATEGORIE,
    ProduitService,
)
from tests.conftest import creer_engine_sqlite, erreur_integrite_postgres


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(CategorieProduit.__table__, Produit.__table__)
    with Session(engine) as session:
        yield session


@pytest.fixture
def service(db: Session) -> ProduitService:
    return ProduitService(db)


@pytest.fixture
def patisserie(db: Session) -> CategorieProduit:
    return CategorieProduitService(db).creer(
        CategorieProduitCreate(libelle="Pâtisserie")
    )


def _charge_utile(id_categorie: int, nom: str = "Éclair") -> ProduitCreate:
    return ProduitCreate(
        nom=nom,
        prix_unitaire=Decimal("3.50"),
        unite_mesure="piece",
        stock_disponible=10,
        id_categorie=id_categorie,
    )


def test_creer_et_obtenir(
    service: ProduitService, patisserie: CategorieProduit
) -> None:
    produit = service.creer(_charge_utile(patisserie.id_categorie))

    assert produit.id_produit is not None
    assert service.obtenir(produit.id_produit).nom == "Éclair"


def test_obtenir_inconnu_leve_ressource_introuvable(service: ProduitService) -> None:
    """404 : la ressource est désignée par l'URL."""
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(99999)


def test_creer_avec_categorie_inexistante_leve_reference_invalide(
    service: ProduitService,
) -> None:
    """422 et non 404 : l'URL est valide, c'est le corps qui ne l'est pas."""
    with pytest.raises(ReferenceInvalide):
        service.creer(_charge_utile(99999))


def test_creer_traduit_aussi_la_violation_de_fk(
    service: ProduitService,
    patisserie: CategorieProduit,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Course : la catégorie disparaît entre le pré-contrôle et le commit."""

    def refuser(_: object) -> None:
        raise erreur_integrite_postgres(CONTRAINTE_PRODUIT_CATEGORIE)

    monkeypatch.setattr(service.produits, "create", refuser)

    with pytest.raises(ReferenceInvalide):
        service.creer(_charge_utile(patisserie.id_categorie))


def test_lister_sans_filtre_retourne_tout(
    service: ProduitService, patisserie: CategorieProduit, db: Session
) -> None:
    autre = CategorieProduitService(db).creer(
        CategorieProduitCreate(libelle="Confiture")
    )
    service.creer(_charge_utile(patisserie.id_categorie, "Éclair"))
    service.creer(_charge_utile(autre.id_categorie, "Confiture de letchi"))

    assert len(service.lister()) == 2


def test_lister_filtre_par_categorie(
    service: ProduitService, patisserie: CategorieProduit, db: Session
) -> None:
    autre = CategorieProduitService(db).creer(
        CategorieProduitCreate(libelle="Confiture")
    )
    service.creer(_charge_utile(patisserie.id_categorie, "Éclair"))
    service.creer(_charge_utile(autre.id_categorie, "Confiture de letchi"))

    resultat = service.lister(patisserie.id_categorie)

    assert [p.nom for p in resultat] == ["Éclair"]


def test_lister_sur_categorie_inexistante_retourne_une_liste_vide(
    service: ProduitService, patisserie: CategorieProduit
) -> None:
    """Un filtre est un critère de recherche, pas la désignation d'une ressource."""
    service.creer(_charge_utile(patisserie.id_categorie))

    assert service.lister(99999) == []


def test_modifier_est_partiel(
    service: ProduitService, patisserie: CategorieProduit
) -> None:
    produit = service.creer(_charge_utile(patisserie.id_categorie))

    service.modifier(produit.id_produit, ProduitUpdate(prix_unitaire=Decimal("4.00")))

    assert produit.prix_unitaire == Decimal("4.00")
    assert produit.nom == "Éclair"
    assert produit.stock_disponible == 10


def test_modifier_vers_une_categorie_inexistante_leve_reference_invalide(
    service: ProduitService, patisserie: CategorieProduit
) -> None:
    produit = service.creer(_charge_utile(patisserie.id_categorie))

    with pytest.raises(ReferenceInvalide):
        service.modifier(produit.id_produit, ProduitUpdate(id_categorie=99999))


def test_supprimer(service: ProduitService, patisserie: CategorieProduit) -> None:
    produit = service.creer(_charge_utile(patisserie.id_categorie))

    service.supprimer(produit.id_produit)

    assert service.lister() == []
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(produit.id_produit)
