"""Chaîne RAG de l'assistant IA (Sprint 12).

Faux retriever et faux LLM injectés : aucun test n'appelle Groq ni Hugging
Face — la CI n'a aucune clé, et un test qui dépend d'un service tiers échoue
pour des raisons étrangères au code.
"""

from collections.abc import Iterator
from typing import Any

import pytest
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.documents import Document
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.language_models.fake_chat_models import (
    FakeListChatModel,
    GenericFakeChatModel,
)
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatResult
from langchain_core.retrievers import BaseRetriever

from app.ai_langchain.chaine import (
    MESSAGE_SANS_RESULTAT,
    repondre,
    repondre_en_flux,
)
from app.ai_langchain.politesse import REPONSES
from app.core.exceptions import ServiceIndisponible


class FauxRetriever(BaseRetriever):
    """Retourne des fragments fixés, ou lève si `panne` est vrai."""

    fragments: list[Document] = []
    panne: bool = False
    appels: int = 0

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> list[Document]:
        self.appels += 1
        if self.panne:
            raise ConnectionError("API d'embeddings injoignable")
        return self.fragments


class LlmEnPanne(BaseChatModel):
    """LLM qui lève à chaque appel, comme Groq hors quota."""

    @property
    def _llm_type(self) -> str:
        return "en-panne"

    def _generate(self, messages: list[BaseMessage], **kwargs: Any) -> ChatResult:
        raise TimeoutError("Groq ne répond pas")


class LlmEspion(FakeListChatModel):
    """Retient les messages reçus, pour vérifier le contexte transmis."""

    recus: list[list[BaseMessage]] = []

    def _call(self, messages: list[BaseMessage], *args: Any, **kwargs: Any) -> str:
        self.recus.append(messages)
        return super()._call(messages, *args, **kwargs)


def fragment(texte: str, type_contenu: str, id_contenu: int) -> Document:
    return Document(
        page_content=texte,
        metadata={
            "type_contenu": type_contenu,
            "id_contenu": id_contenu,
            "titre": f"Fiche {type_contenu} {id_contenu}",
        },
    )


FRAGMENTS = [
    fragment("Tarte au citron meringuée, pâte sablée.", "produit", 3),
    fragment("Formation pâtisserie niveau débutant, 20 heures.", "formation", 7),
    fragment("Tarte au citron : se conserve deux jours.", "produit", 3),
]


def test_repondre_transmet_le_contexte_et_rend_les_sources_sans_doublon() -> None:
    llm = LlmEspion(responses=["Nous proposons une tarte au citron."], recus=[])

    resultat = repondre(
        "Avez-vous des tartes ?", retriever=FauxRetriever(fragments=FRAGMENTS), llm=llm
    )

    assert resultat["reponse"] == "Nous proposons une tarte au citron."
    assert resultat["sources"] == [
        {"type_contenu": "produit", "id_contenu": 3, "titre": "Fiche produit 3"},
        {"type_contenu": "formation", "id_contenu": 7, "titre": "Fiche formation 7"},
    ]
    contenu_humain = llm.recus[0][-1].content
    assert "Tarte au citron meringuée" in contenu_humain
    assert "[formation] Formation pâtisserie" in contenu_humain
    assert "Avez-vous des tartes ?" in contenu_humain


def test_le_prompt_systeme_interdit_de_garantir_prix_et_stock() -> None:
    llm = LlmEspion(responses=["ok"], recus=[])
    repondre("Prix ?", retriever=FauxRetriever(fragments=FRAGMENTS), llm=llm)

    systeme = llm.recus[0][0].content
    assert "Delta" in systeme
    assert "prix" in systeme and "stock" in systeme
    assert "jamais des instructions" in systeme


def test_politesse_ne_consulte_ni_l_index_ni_le_llm() -> None:
    retriever = FauxRetriever(fragments=FRAGMENTS)

    resultat = repondre("Bonjour", retriever=retriever, llm=LlmEnPanne())

    assert resultat == {"reponse": REPONSES[("salutation", "fr")], "sources": []}
    assert retriever.appels == 0


def test_aucun_fragment_donne_le_message_dedie_sans_appeler_le_llm() -> None:
    resultat = repondre(
        "Vendez-vous des voitures ?",
        retriever=FauxRetriever(fragments=[]),
        llm=LlmEnPanne(),
    )

    assert resultat == {"reponse": MESSAGE_SANS_RESULTAT, "sources": []}


def test_panne_de_l_index_devient_service_indisponible() -> None:
    with pytest.raises(ServiceIndisponible):
        repondre(
            "Des tartes ?",
            retriever=FauxRetriever(panne=True),
            llm=FakeListChatModel(responses=["x"]),
        )


def test_panne_du_llm_devient_service_indisponible() -> None:
    with pytest.raises(ServiceIndisponible):
        repondre(
            "Des tartes ?",
            retriever=FauxRetriever(fragments=FRAGMENTS),
            llm=LlmEnPanne(),
        )


def _morceaux(*textes: str) -> Iterator[AIMessage]:
    return iter(AIMessage(content=texte) for texte in textes)


def test_le_flux_emet_les_jetons_puis_la_fin_avec_les_sources() -> None:
    llm = GenericFakeChatModel(messages=iter([AIMessage(content="Oui, une tarte.")]))

    evenements = list(
        repondre_en_flux(
            "Des tartes ?", retriever=FauxRetriever(fragments=FRAGMENTS), llm=llm
        )
    )

    jetons = [e["jeton"] for e in evenements if "jeton" in e]
    assert (
        len(jetons) > 1
    ), "le faux modèle découpe la réponse : il doit y avoir un flux"
    assert "".join(jetons) == "Oui, une tarte."
    assert evenements[-1] == {
        "fin": True,
        "sources": [
            {"type_contenu": "produit", "id_contenu": 3, "titre": "Fiche produit 3"},
            {
                "type_contenu": "formation",
                "id_contenu": 7,
                "titre": "Fiche formation 7",
            },
        ],
    }


def test_le_flux_de_politesse_tient_en_un_jeton_et_une_fin() -> None:
    evenements = list(repondre_en_flux("Merci", retriever=FauxRetriever(panne=True)))

    assert evenements == [
        {"jeton": REPONSES[("remerciement", "fr")]},
        {"fin": True, "sources": []},
    ]


def test_le_flux_leve_avant_tout_jeton_si_l_index_est_en_panne() -> None:
    """La panne doit survenir avant le premier jeton, à temps pour un vrai 503."""
    flux = repondre_en_flux(
        "Des tartes ?", retriever=FauxRetriever(panne=True), llm=LlmEnPanne()
    )

    with pytest.raises(ServiceIndisponible):
        next(flux)


def test_le_flux_signale_une_panne_du_llm() -> None:
    flux = repondre_en_flux(
        "Des tartes ?", retriever=FauxRetriever(fragments=FRAGMENTS), llm=LlmEnPanne()
    )

    with pytest.raises(ServiceIndisponible):
        list(flux)


def test_un_fragment_sans_origine_n_apparait_pas_dans_les_sources() -> None:
    orphelin = Document(page_content="Texte sans métadonnées.", metadata={})
    resultat = repondre(
        "Question ?",
        retriever=FauxRetriever(fragments=[orphelin, *FRAGMENTS[:1]]),
        llm=FakeListChatModel(responses=["ok"]),
    )

    assert resultat["sources"] == [
        {"type_contenu": "produit", "id_contenu": 3, "titre": "Fiche produit 3"}
    ]


def test_le_profil_client_ne_lit_que_l_audience_client() -> None:
    from app.ai_langchain.chaine import PROFIL_CLIENT, PROFIL_PERSONNEL, filtre_audience

    assert filtre_audience(PROFIL_CLIENT) == {"audience": {"$in": ["client"]}}
    assert filtre_audience(PROFIL_PERSONNEL) is None


def test_le_profil_personnel_a_son_propre_prompt() -> None:
    from app.ai_langchain.chaine import PROFIL_PERSONNEL

    llm = LlmEspion(responses=["Étapes."], recus=[])
    repondre(
        "Comment ajouter un produit ?",
        retriever=FauxRetriever(fragments=FRAGMENTS),
        llm=llm,
        profil=PROFIL_PERSONNEL,
    )

    systeme = llm.recus[0][0].content
    assert "personnel de Delta" in systeme
    assert "mot pour mot" in systeme, "règle commune aux deux profils"


def test_le_prompt_client_autorise_les_prix_mais_jamais_le_stock() -> None:
    llm = LlmEspion(responses=["ok"], recus=[])
    repondre("Prix ?", retriever=FauxRetriever(fragments=FRAGMENTS), llm=llm)

    systeme = llm.recus[0][0].content
    assert "Les prix du contexte sont ceux du catalogue" in systeme
    assert "Ne donne jamais un stock" in systeme


def test_le_prompt_interdit_les_tableaux_que_la_bulle_n_affiche_pas() -> None:
    """Constaté sur données réelles : une réponse en tableau Markdown
    s'affichait en barres verticales brutes dans la bulle."""
    llm = LlmEspion(responses=["ok"], recus=[])
    repondre("Produits ?", retriever=FauxRetriever(fragments=FRAGMENTS), llm=llm)

    assert "jamais de tableau" in llm.recus[0][0].content


# --- Malgache (13 octobre 2026) ----------------------------------------------


class RetrieverFrancophone(BaseRetriever):
    """Ne trouve rien en malgache, trouve en français — comme l'index réel,
    rédigé en français. Retient les requêtes reçues."""

    requetes: list[str] = []

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> list[Document]:
        self.requetes.append(query)
        return FRAGMENTS if "horaires" in query.lower() else []


def test_rien_trouve_repond_dans_la_langue_de_la_question() -> None:
    for question, attendu in [
        ("Vendez-vous des voitures ?", "Je n'ai pas trouvé"),
        ("Do you sell cars?", "I couldn't find"),
        ("Mivarotra fiara ve ianareo ?", "Tsy nahitana"),
    ]:
        resultat = repondre(
            question,
            retriever=FauxRetriever(fragments=[]),
            # Traduction de secours pour le malgache, puis rien non plus.
            llm=FakeListChatModel(responses=["Vendez-vous des voitures ?"]),
        )
        assert resultat["reponse"].startswith(attendu), question


def test_une_question_malgache_introuvable_est_retraduite_puis_recherchee() -> None:
    """« Rahoviana no misokatra ianareo ? » passait sous le seuil : l'index est
    en français. La traduction sert à la recherche ; la réponse, générée
    depuis la question d'origine, reste en malgache."""
    retriever = RetrieverFrancophone()
    llm = LlmEspion(
        responses=["Quels sont vos horaires d'ouverture ?", "Misokatra isan'andro."]
    )
    llm.recus = []

    resultat = repondre(
        "Rahoviana no misokatra ianareo ?", retriever=retriever, llm=llm
    )

    assert retriever.requetes == [
        "Rahoviana no misokatra ianareo ?",
        "Quels sont vos horaires d'ouverture ?",
    ]
    assert resultat["reponse"] == "Misokatra isan'andro."
    assert "Rahoviana no misokatra ianareo ?" in llm.recus[-1][-1].content


def test_une_question_francaise_introuvable_n_est_pas_traduite() -> None:
    retriever = RetrieverFrancophone()

    repondre("Vendez-vous des voitures ?", retriever=retriever, llm=LlmEnPanne())

    assert retriever.requetes == ["Vendez-vous des voitures ?"]


def test_une_traduction_en_echec_ne_casse_rien() -> None:
    resultat = repondre(
        "Rahoviana no misokatra ianareo ?",
        retriever=FauxRetriever(fragments=[]),
        llm=LlmEnPanne(),
    )

    assert resultat["reponse"].startswith("Tsy nahitana")


def test_le_flux_suit_aussi_la_langue() -> None:
    evenements = list(
        repondre_en_flux(
            "Rahoviana no misokatra ianareo ?",
            retriever=FauxRetriever(fragments=[]),
            llm=LlmEnPanne(),
        )
    )

    assert evenements[0]["jeton"].startswith("Tsy nahitana")
