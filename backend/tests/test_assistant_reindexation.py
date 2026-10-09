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
        "document",
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


def test_un_document_interne_garde_son_audience_apres_reindexation(
    session_postgres: Session, store: PGVector
) -> None:
    """Le chemin du déploiement : tout l'index reconstruit d'un coup. Un
    document « Personnel » doit en ressortir `personnel`, et rester invisible
    du filtre client."""
    from app.ai_langchain.chaine import PROFIL_CLIENT, filtre_audience
    from app.models.document_connaissance import (
        DocumentConnaissance,
        PublicCible,
        TypeFichier,
    )
    from app.models.personnel import FonctionPersonnel, Personnel

    auteur = Personnel(
        nom="Auteur",
        prenom="Test",
        fonction=FonctionPersonnel.AUTRE,
        email=f"auteur_{uuid.uuid4().hex[:8]}@delta.mg",
    )
    session_postgres.add(auteur)
    session_postgres.flush()
    interne = DocumentConnaissance(
        titre="Procédure de fermeture de caisse",
        nom_fichier="caisse.txt",
        type_fichier=TypeFichier.TXT,
        taille_octets=42,
        public_cible=PublicCible.PERSONNEL,
        texte_extrait="Compter le fond de caisse avant de fermer le comptoir.",
        id_personnel=auteur.id_personnel,
    )
    session_postgres.add(interne)
    session_postgres.flush()

    reindexer_tout(session_postgres)

    tous = store.similarity_search("fond de caisse", k=50)
    fragments = [
        d
        for d in tous
        if d.metadata["type_contenu"] == "document"
        and d.metadata["id_contenu"] == interne.id_document
    ]
    assert fragments and all(d.metadata["audience"] == "personnel" for d in fragments)
    vus_client = store.similarity_search(
        "fond de caisse", k=50, filter=filtre_audience(PROFIL_CLIENT)
    )
    assert all(
        d.metadata.get("id_contenu") != interne.id_document
        or d.metadata["type_contenu"] != "document"
        for d in vus_client
    )


class _FournisseurEnPanne(DeterministicFakeEmbedding):
    """Embeddings qui échouent comme Hugging Face à court de crédits."""

    def embed_query(self, text: str) -> list[float]:
        raise RuntimeError("Client error '402 Payment Required'")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        raise RuntimeError("Client error '402 Payment Required'")


def test_un_fournisseur_en_panne_annule_sans_rien_effacer(
    session_postgres: Session, store: PGVector, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Régression du 9 octobre 2026 : sur un 402, la réindexation vidait les
    produits puis échouait, et ils disparaissaient de l'index."""
    _peupler(session_postgres)
    reindexer_tout(session_postgres)
    avant = _contenus(store)
    assert any(t == "produit" for t, _, _ in avant)

    en_panne = creer_vector_store(_FournisseurEnPanne(size=1024), store.collection_name)
    monkeypatch.setattr(reindexation, "obtenir_vector_store", lambda: en_panne)

    with pytest.raises(ServiceIndisponible, match="crédits.*n'a pas été modifié"):
        reindexer_tout(session_postgres)

    assert sorted(_contenus(store)) == sorted(avant)
