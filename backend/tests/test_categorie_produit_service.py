"""Tests du service CATEGORIE_PRODUIT."""

from collections.abc import Iterator
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier, RessourceIntrouvable
from app.core.integrite import viole_contrainte
from app.models.categorie_produit import CategorieProduit
from app.models.produit import Produit
from app.schemas.categorie_produit import (
    CategorieProduitCreate,
    CategorieProduitUpdate,
)
from app.services.categorie_produit_service import (
    CONTRAINTE_LIBELLE_UNIQUE,
    CONTRAINTE_PRODUIT_CATEGORIE,
    CategorieProduitService,
)
from tests.conftest import creer_engine_sqlite, erreur_integrite_postgres


@pytest.fixture
def db() -> Iterator[Session]:
    engine = creer_engine_sqlite(CategorieProduit.__table__, Produit.__table__)
    with Session(engine) as session:
        yield session


@pytest.fixture
def service(db: Session) -> CategorieProduitService:
    return CategorieProduitService(db)


def _ajouter_produit(db: Session, id_categorie: int) -> Produit:
    produit = Produit(
        nom="Éclair",
        prix_unitaire=Decimal("3.50"),
        unite_mesure="piece",
        stock_disponible=5,
        est_personnalisable=False,
        est_livrable=True,
        id_categorie=id_categorie,
    )
    db.add(produit)
    db.commit()
    return produit


def test_creer_et_lister(service: CategorieProduitService) -> None:
    service.creer(CategorieProduitCreate(libelle="Pâtisserie"))
    service.creer(CategorieProduitCreate(libelle="Boulangerie"))

    assert {c.libelle for c in service.lister()} == {"Pâtisserie", "Boulangerie"}


def test_obtenir_inconnu_leve_ressource_introuvable(
    service: CategorieProduitService,
) -> None:
    """404, la ressource est désignée par l'URL."""
    with pytest.raises(RessourceIntrouvable):
        service.obtenir(99999)


def test_libelle_en_double_refuse_par_le_precontrole(
    service: CategorieProduitService,
) -> None:
    service.creer(CategorieProduitCreate(libelle="Pâtisserie"))

    with pytest.raises(ConflitMetier):
        service.creer(CategorieProduitCreate(libelle="Pâtisserie"))


def test_libelle_en_double_refuse_malgre_le_precontrole(
    service: CategorieProduitService, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Course entre deux créations : la contrainte en base doit trancher.

    Le pré-contrôle est aveuglé pour simuler une insertion concurrente entre la
    vérification et le `commit`. Le test échoue si l'`IntegrityError` remonte
    brute au lieu d'être traduite.
    """
    service.creer(CategorieProduitCreate(libelle="Pâtisserie"))
    monkeypatch.setattr(service.categories, "get_by_libelle", lambda libelle: None)

    with pytest.raises(ConflitMetier):
        service.creer(CategorieProduitCreate(libelle="Pâtisserie"))


def test_modifier_est_partiel(service: CategorieProduitService) -> None:
    categorie = service.creer(CategorieProduitCreate(libelle="Patisserie"))

    service.modifier(
        categorie.id_categorie, CategorieProduitUpdate(libelle="Pâtisserie")
    )

    assert categorie.libelle == "Pâtisserie"


def test_modifier_sans_champ_ne_change_rien(service: CategorieProduitService) -> None:
    """Un corps vide ne doit pas écraser le libellé par `None`."""
    categorie = service.creer(CategorieProduitCreate(libelle="Pâtisserie"))

    service.modifier(categorie.id_categorie, CategorieProduitUpdate())

    assert categorie.libelle == "Pâtisserie"


def test_supprimer_une_categorie_vide(service: CategorieProduitService) -> None:
    categorie = service.creer(CategorieProduitCreate(libelle="Confiture"))

    service.supprimer(categorie.id_categorie)

    assert service.lister() == []


def test_supprimer_une_categorie_referencee_leve_conflit(
    service: CategorieProduitService, db: Session
) -> None:
    """Message métier, pas une trace SQL : la FK est en ON DELETE RESTRICT."""
    categorie = service.creer(CategorieProduitCreate(libelle="Pâtisserie"))
    _ajouter_produit(db, categorie.id_categorie)

    with pytest.raises(ConflitMetier) as capture:
        service.supprimer(categorie.id_categorie)

    assert "contient encore des produits" in str(capture.value)
    assert len(service.lister()) == 1


def test_supprimer_traduit_aussi_la_violation_de_fk(
    service: CategorieProduitService, monkeypatch: pytest.MonkeyPatch, db: Session
) -> None:
    """Filet de course : un produit créé après le pré-contrôle.

    SQLite ne nomme pas la contrainte violée, d'où l'erreur fabriquée à la forme
    PostgreSQL — c'est cette branche-là qui protège en production.
    """
    categorie = service.creer(CategorieProduitCreate(libelle="Pâtisserie"))

    def refuser(_: object) -> None:
        raise erreur_integrite_postgres(CONTRAINTE_PRODUIT_CATEGORIE)

    monkeypatch.setattr(service.categories, "delete", refuser)

    with pytest.raises(ConflitMetier) as capture:
        service.supprimer(categorie.id_categorie)

    assert "contient encore des produits" in str(capture.value)


def test_une_autre_violation_nest_pas_traduite(
    service: CategorieProduitService, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Une contrainte étrangère au cas traité doit remonter, pas être maquillée.

    Sans ce test, il suffirait d'attraper toute `IntegrityError` pour la
    présenter comme un doublon de libellé — un message faux, et un vrai bug
    masqué.
    """
    monkeypatch.setattr(service.categories, "get_by_libelle", lambda libelle: None)

    def refuser(_: object) -> None:
        raise erreur_integrite_postgres("uq_une_autre_contrainte")

    monkeypatch.setattr(service.categories, "create", refuser)

    with pytest.raises(Exception) as capture:
        service.creer(CategorieProduitCreate(libelle="Pâtisserie"))

    assert not isinstance(capture.value, ConflitMetier)


def test_viole_contrainte_lit_le_nom_fourni_par_postgres() -> None:
    erreur = erreur_integrite_postgres(CONTRAINTE_LIBELLE_UNIQUE)

    assert viole_contrainte(erreur, CONTRAINTE_LIBELLE_UNIQUE)
    assert not viole_contrainte(erreur, CONTRAINTE_PRODUIT_CATEGORIE)
