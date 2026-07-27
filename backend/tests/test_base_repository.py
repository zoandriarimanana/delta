"""Tests du CRUD générique de `BaseRepository`.

Le repository est exercé sur `CategorieProduit`, la plus simple des 20 entités
(deux colonnes, aucune clé étrangère), contre une base SQLite en mémoire : ces
tests valident la mécanique générique, pas le dialecte PostgreSQL, et n'ont
donc besoin d'aucun serveur.
"""

from collections.abc import Iterator
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.database import Base
from app.models.categorie_produit import CategorieProduit
from app.models.produit import Produit
from app.repositories.base_repository import BaseRepository


class _CategorieProduitRepository(BaseRepository[CategorieProduit]):
    """Sous-classe minimale : illustre le contrat attendu des repositories
    spécifiques — déclarer `modele`, et rien d'autre tant que le CRUD suffit."""

    modele = CategorieProduit


class _ProduitRepository(BaseRepository[Produit]):
    modele = Produit


@pytest.fixture
def db() -> Iterator[Session]:
    """Session sur une base SQLite en mémoire, limitée aux tables nécessaires.

    `produit` est créée en plus de `categorie_produit` : au `delete`, SQLAlchemy
    charge la relation `CategorieProduit.produits` pour appliquer la cascade, ce
    qui suppose la table présente.
    """
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        engine, tables=[CategorieProduit.__table__, Produit.__table__]
    )
    with Session(engine) as session:
        yield session


@pytest.fixture
def repository(db: Session) -> _CategorieProduitRepository:
    return _CategorieProduitRepository(db)


def test_create_attribue_la_cle_primaire(
    repository: _CategorieProduitRepository,
) -> None:
    """Le `flush` interne rend la PK disponible sans validation de transaction."""
    categorie = repository.create({"libelle": "Pâtisserie"})

    assert categorie.id_categorie is not None
    assert categorie.libelle == "Pâtisserie"


def test_create_ne_valide_pas_la_transaction(
    repository: _CategorieProduitRepository, db: Session
) -> None:
    """Contrat central : le repository ne commit jamais.

    C'est ce qui permet au service de regrouper plusieurs écritures dans une
    seule unité de travail. Si ce test échoue, un `commit()` s'est glissé dans
    la couche repository.
    """
    repository.create({"libelle": "Boulangerie"})
    db.rollback()

    assert repository.list() == []


def test_get_by_id_trouve_et_ne_trouve_pas(
    repository: _CategorieProduitRepository,
) -> None:
    categorie = repository.create({"libelle": "Confiture"})

    assert repository.get_by_id(categorie.id_categorie) is categorie
    assert repository.get_by_id(999) is None


def test_list_retourne_tout_par_defaut(
    repository: _CategorieProduitRepository,
) -> None:
    for libelle in ("Pâtisserie", "Boulangerie", "Confiture"):
        repository.create({"libelle": libelle})

    assert len(repository.list()) == 3


def test_list_pagine(repository: _CategorieProduitRepository) -> None:
    for libelle in ("Pâtisserie", "Boulangerie", "Confiture"):
        repository.create({"libelle": libelle})

    page = repository.list(skip=1, limit=1)

    assert [categorie.libelle for categorie in page] == ["Boulangerie"]


def test_update_est_partiel(repository: _CategorieProduitRepository) -> None:
    """Une clé absente du dictionnaire laisse la colonne inchangée."""
    categorie = repository.create({"libelle": "Patisserie"})

    repository.update(categorie, {"libelle": "Pâtisserie"})

    assert categorie.libelle == "Pâtisserie"
    assert categorie.id_categorie is not None


def test_update_ne_touche_aucune_autre_colonne(
    db: Session, repository: _CategorieProduitRepository
) -> None:
    """Contrat central : `update` n'écrit QUE les clés reçues.

    Exercé sur `Produit`, qui a assez de colonnes pour que la garde ait un sens.
    L'assertion porte sur l'ensemble des colonnes réellement modifiées, pas sur
    une liste choisie à la main : elle tiendra donc si des colonnes sont ajoutées
    à l'entité plus tard.

    Si ce test échoue, `update` a cessé d'être partiel — typiquement parce qu'un
    `model_dump()` sans `exclude_unset=True` a rempli le dictionnaire de valeurs
    par défaut.
    """
    categorie = repository.create({"libelle": "Pâtisserie"})
    produits = _ProduitRepository(db)
    produit = produits.create(
        {
            "nom": "Éclair au chocolat",
            "description": "Pâte à choux, crème pâtissière",
            "prix_unitaire": Decimal("3.50"),
            "unite_mesure": "piece",
            "stock_disponible": 12,
            "est_personnalisable": False,
            "est_livrable": True,
            "id_categorie": categorie.id_categorie,
        }
    )
    colonnes = [colonne.name for colonne in Produit.__table__.columns]
    avant = {nom: getattr(produit, nom) for nom in colonnes}

    produits.update(produit, {"prix_unitaire": Decimal("4.00")})

    apres = {nom: getattr(produit, nom) for nom in colonnes}
    modifiees = {nom for nom in colonnes if avant[nom] != apres[nom]}

    assert modifiees == {"prix_unitaire"}
    assert produit.prix_unitaire == Decimal("4.00")


def test_delete_retire_l_entite(repository: _CategorieProduitRepository) -> None:
    categorie = repository.create({"libelle": "Confiture"})
    identifiant = categorie.id_categorie

    repository.delete(categorie)

    assert repository.get_by_id(identifiant) is None
    assert repository.list() == []
