"""Restauration d'une catégorie, contre PostgreSQL uniquement.

Le conflit que ces tests construisent **n'existe que sur PostgreSQL** :
`uq_categorie_produit_libelle` est un index **partiel**
(`WHERE supprime_le IS NULL`), et SQLite ne sait ni le créer ni nommer la
contrainte violée.

Le fichier est séparé parce que `test_categorie_produit_service.py` monte une
base SQLite en mémoire. Y ajouter une fixture PostgreSQL ferait cohabiter deux
supports dans un même module, pour deux tests.
"""

from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import ConflitMetier
from app.schemas.categorie_produit import CategorieProduitCreate
from app.services.categorie_produit_service import (
    CONTRAINTE_LIBELLE_UNIQUE,
    CategorieProduitService,
)

pytestmark = pytest.mark.postgres


@pytest.fixture
def db(session_postgres: Session) -> Session:
    return session_postgres


@pytest.fixture
def service(db: Session) -> CategorieProduitService:
    return CategorieProduitService(db)


def _libelle() -> str:
    """Libellé unique : l'index reste actif sur les lignes des autres tests."""
    return f"Catégorie {uuid4().hex[:8]}"


def test_le_libelle_reattribue_refuse_la_restauration(
    service: CategorieProduitService,
) -> None:
    """**Le cas que l'index partiel rend possible**, construit et non simulé.

    Le libellé libéré par l'archivage a été repris par une catégorie active :
    restaurer l'ancienne créerait deux catégories actives homonymes. La base le
    refuse, et le service doit en faire un message métier.

    C'est précisément ce que `docs/architecture.md` annonce sous
    « `restaurer()` peut échouer légitimement ».
    """
    libelle = _libelle()
    ancienne = service.creer(CategorieProduitCreate(libelle=libelle))
    service.supprimer(ancienne.id_categorie)
    # L'index étant partiel, recréer le même libellé est autorisé — c'est même
    # la raison d'être de sa partialité.
    service.creer(CategorieProduitCreate(libelle=libelle))

    with pytest.raises(ConflitMetier) as capture:
        service.restaurer(ancienne.id_categorie)

    message = str(capture.value)
    assert "restauration impossible" in message
    assert "UNIQUE" not in message
    assert CONTRAINTE_LIBELLE_UNIQUE not in message


def test_la_categorie_reste_archivee_apres_le_refus(
    service: CategorieProduitService, db: Session
) -> None:
    """Le `rollback` du service ne laisse pas la ligne à moitié restaurée.

    Sans lui, la transaction resterait cassée et la catégorie pourrait
    apparaître active en mémoire alors que la base l'a refusée.
    """
    libelle = _libelle()
    ancienne = service.creer(CategorieProduitCreate(libelle=libelle))
    service.supprimer(ancienne.id_categorie)
    service.creer(CategorieProduitCreate(libelle=libelle))

    with pytest.raises(ConflitMetier):
        service.restaurer(ancienne.id_categorie)

    db.refresh(ancienne)
    assert ancienne.supprime_le is not None


def test_sans_collision_la_restauration_aboutit(
    service: CategorieProduitService,
) -> None:
    """Contrôle positif : sans lui, un service qui refuserait toute
    restauration passerait les deux tests ci-dessus."""
    categorie = service.creer(CategorieProduitCreate(libelle=_libelle()))
    service.supprimer(categorie.id_categorie)

    assert service.restaurer(categorie.id_categorie).supprime_le is None
