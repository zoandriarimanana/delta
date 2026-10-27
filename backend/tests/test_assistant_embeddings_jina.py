"""Fournisseur d'embeddings Jina AI (12 octobre 2026) — sans réseau."""

import json

import httpx
import pytest
from pydantic import ValidationError

from app.ai_langchain import embeddings
from app.ai_langchain.embeddings_jina import TAILLE_LOT, JinaEmbeddings
from app.core.config import Settings, settings
from app.core.exceptions import ServiceIndisponible


def _faux_jina(requetes: list[dict], statut: int = 200) -> httpx.MockTransport:
    """Répond un vecteur par texte, dans le désordre — comme l'API peut le
    faire —, et garde chaque requête reçue."""

    def repondre(requete: httpx.Request) -> httpx.Response:
        corps = json.loads(requete.content)
        requetes.append({**corps, "auth": requete.headers["Authorization"]})
        if statut != 200:
            return httpx.Response(statut, json={"detail": "refus"})
        data = [
            {"index": i, "embedding": [float(i), float(len(texte))]}
            for i, texte in enumerate(corps["input"])
        ]
        return httpx.Response(200, json={"data": list(reversed(data))})

    return httpx.MockTransport(repondre)


def _jina(requetes: list[dict], statut: int = 200) -> JinaEmbeddings:
    return JinaEmbeddings(
        "jina_test", "jina-embeddings-v3", 1024, transport=_faux_jina(requetes, statut)
    )


def test_les_passages_et_les_questions_ne_sont_pas_vectorises_pareil() -> None:
    requetes: list[dict] = []
    jina = _jina(requetes)

    jina.embed_documents(["un passage"])
    jina.embed_query("une question ?")

    assert [r["task"] for r in requetes] == ["retrieval.passage", "retrieval.query"]
    assert all(r["model"] == "jina-embeddings-v3" for r in requetes)
    assert all(r["dimensions"] == 1024 for r in requetes)
    assert requetes[0]["auth"] == "Bearer jina_test"


def test_les_vecteurs_reviennent_dans_l_ordre_des_textes() -> None:
    vecteurs = _jina([]).embed_documents(["a", "bb", "ccc"])

    assert vecteurs == [[0.0, 1.0], [1.0, 2.0], [2.0, 3.0]]


def test_les_longues_listes_partent_par_lots() -> None:
    requetes: list[dict] = []
    textes = [f"t{i}" for i in range(TAILLE_LOT + 5)]

    vecteurs = _jina(requetes).embed_documents(textes)

    assert [len(r["input"]) for r in requetes] == [TAILLE_LOT, 5]
    assert len(vecteurs) == len(textes)


def test_une_liste_vide_n_appelle_pas_l_api() -> None:
    requetes: list[dict] = []

    assert _jina(requetes).embed_documents([]) == []
    assert requetes == []


def test_un_refus_porte_son_code_http() -> None:
    """Le code (402, 401…) doit figurer dans le message : c'est lui que la
    réindexation traduit en phrase lisible."""
    with pytest.raises(httpx.HTTPStatusError, match="402"):
        _jina([], statut=402).embed_query("Bonjour")


def test_avec_jina_la_cle_exigee_est_celle_de_jina(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EMBEDDINGS_FOURNISSEUR", "jina")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_x")
    monkeypatch.setenv("JINA_API_KEY", "jina_x")

    reglages = Settings(AI_ENABLED=None)

    assert reglages.AI_ENABLED is True
    assert reglages.modele_embeddings == "jina-embeddings-v3"

    monkeypatch.setenv("JINA_API_KEY", "")
    with pytest.raises(ValidationError, match="JINA_API_KEY"):
        Settings(AI_ENABLED=True)


def test_l_embedder_jina_est_choisi_par_le_reglage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "EMBEDDINGS_FOURNISSEUR", "jina")
    monkeypatch.setattr(settings, "JINA_API_KEY", "jina_test")
    embeddings.obtenir_embeddings.cache_clear()
    try:
        assert isinstance(embeddings.obtenir_embeddings(), JinaEmbeddings)
        monkeypatch.setattr(settings, "JINA_API_KEY", "")
        embeddings.obtenir_embeddings.cache_clear()
        with pytest.raises(ServiceIndisponible, match="JINA_API_KEY"):
            embeddings.obtenir_embeddings()
    finally:
        embeddings.obtenir_embeddings.cache_clear()
