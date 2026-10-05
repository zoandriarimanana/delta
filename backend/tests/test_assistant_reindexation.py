"""Réindexation complète de l'assistant IA (Sprint 12, 12.3).

Vraie base et vrai index PGVector, mais **collection jetable et faux
embeddings** : `obtenir_vector_store` est redirigé vers une collection de test,
supprimée en sortie. Les données métier vivent dans `session_postgres`, annulée
en fin de test ; la réindexation les lit par cette même session.
"""

import uuid
from collections.abc import Iterator
from decimal import Decimal

import pytest
from langchain_core.embeddings import DeterministicFakeEmbedding
from langchain_postgres import PGVector
from sqlalchemy.orm import Session

from app.ai_langchain import reindexation
from app.ai_langchain.reindexation import reindexer_tout
from app.ai_langchain.vector_store import creer_vector_store
from app.core.config import settings
from app.core.exceptions import ServiceIndisponible
from app.models.categorie_produit import CategorieProduit
from app.models.logement import Logement, StatutLogement
from app.models.produit import Produit
from app.models.salle import Salle


@pytest.fixture
def store(
    session_postgres: Session, monkeypatch: pytest.MonkeyPatch
) -> Iterator[PGVector]:
    store = creer_vector_store(
        DeterministicFakeEmbedding(size=1024), f"test_{uuid.uuid4().hex[:12]}"
    )
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(reindexation, "obtenir_vector_store", lambda: store)
    try:
        yield store
    finally:
        store.delete_collection()


def _contenus(store: PGVector) -> list[tuple[str, int, str]]:
    return [
        (d.metadata["type_contenu"], d.metadata["id_contenu"], d.page_content)
        for d in store.similarity_search("catalogue", k=500)
    ]


def _peupler(db: Session) -> dict[str, int]:
    from datetime import datetime

    categorie = CategorieProduit(libelle=f"Réindexation {uuid.uuid4().hex[:6]}")
    db.add(categorie)
    db.flush()
    actif = Produit(
        nom="Pain au levain",
        prix_unitaire=Decimal("12345.67"),
        unite_mesure="pièce",
        stock_disponible=987,
        id_categorie=categorie.id_categorie,
    )
    archive = Produit(
        nom="Produit archivé",
        prix_unitaire=Decimal("1"),
        unite_mesure="pièce",
        id_categorie=categorie.id_categorie,
        supprime_le=datetime(2026, 1, 1),
    )
    hors_service = Logement(
        type_chambre="triple",
        capacite=3,
        tarif_nuitee=Decimal("1"),
        statut=StatutLogement.HORS_SERVICE,
    )
    salle = Salle(nom="Salle Baobab", capacite=12, tarif_journee=Decimal("98765"))
    db.add_all([actif, archive, hors_service, salle])
    db.flush()
    return {
        "actif": actif.id_produit,
        "archive": archive.id_produit,
        "hors_service": hors_service.id_logement,
        "salle": salle.id_salle,
    }


def test_reindexer_n_indexe_que_l_actif_et_jamais_le_stock(
    session_postgres: Session, store: PGVector
) -> None:
    ids = _peupler(session_postgres)

    resultats = reindexer_tout(session_postgres)

    contenus = _contenus(store)
    indexes = {(t, i) for t, i, _ in contenus}
    assert ("produit", ids["actif"]) in indexes
    assert ("produit", ids["archive"]) not in indexes
    assert ("logement", ids["hors_service"]) not in indexes
    assert ("salle", ids["salle"]) in indexes
    for _, _, texte in contenus:
        assert "987" not in texte, "le stock n'est jamais indexé"
    assert set(resultats) == {
        "produit",
        "categorie_produit",
        "formation",
        "domaine_formation",
        "salle",
        "logement",
        "guide",
    }
    assert resultats["produit"]["elements"] >= 1


def test_reindexer_retire_ce_qui_n_existe_plus(
    session_postgres: Session, store: PGVector
) -> None:
    """Un fragment orphelin — entité supprimée depuis — doit disparaître."""
    from app.ai_langchain.indexation import indexer_texte

    indexer_texte("produit", 999_999_999, "Produit fantôme jamais en base", store)

    reindexer_tout(session_postgres)

    assert ("produit", 999_999_999) not in {(t, i) for t, i, _ in _contenus(store)}


def test_reindexer_un_assistant_desactive_leve(
    session_postgres: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AI_ENABLED", False)

    with pytest.raises(ServiceIndisponible, match="désactivé"):
        reindexer_tout(session_postgres)
