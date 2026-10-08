"""Garde de politesse de l'assistant IA (Sprint 12).

Ce qui compte le plus ici, c'est le cas négatif : une vraie question qui
commence par « bonjour » ne doit jamais être interceptée — elle resterait
sans réponse.
"""

import pytest

from app.ai_langchain.politesse import REPONSES, reponse_politesse


@pytest.mark.parametrize(
    "message",
    ["Bonjour", "bonsoir !", "Salut tout le monde", "BONJOUR madame"],
)
def test_une_salutation_seule_recoit_la_salutation_francaise(message: str) -> None:
    assert reponse_politesse(message) == REPONSES[("salutation", "fr")]


@pytest.mark.parametrize("message", ["Merci", "merci beaucoup !"])
def test_un_remerciement_seul_recoit_le_remerciement(message: str) -> None:
    assert reponse_politesse(message) == REPONSES[("remerciement", "fr")]


@pytest.mark.parametrize("message", ["Au revoir", "à bientôt"])
def test_un_au_revoir_seul_recoit_l_au_revoir(message: str) -> None:
    assert reponse_politesse(message) == REPONSES[("au_revoir", "fr")]


@pytest.mark.parametrize(
    ("message", "intention"),
    [
        ("Hello", "salutation"),
        ("Hi!", "salutation"),
        ("Thank you", "remerciement"),
        ("Thanks", "remerciement"),
        ("Bye", "au_revoir"),
        ("Goodbye", "au_revoir"),
    ],
)
def test_l_anglais_seul_recoit_une_reponse_en_anglais(
    message: str, intention: str
) -> None:
    """Interface client en anglais depuis le 8 octobre 2026 : un « Hello »
    reçoit sa réponse en anglais, plus en français."""
    assert reponse_politesse(message) == REPONSES[(intention, "en")]


def test_un_melange_francais_anglais_reste_en_francais() -> None:
    assert reponse_politesse("Hello tout le monde") == REPONSES[("salutation", "fr")]


@pytest.mark.parametrize(
    ("message", "intention"),
    [
        ("Salama tompoko", "salutation"),
        ("Manao ahoana", "salutation"),
        ("Misaotra betsaka", "remerciement"),
        ("Veloma", "au_revoir"),
        ("Mandra-pihaona amin'ny manaraka", "au_revoir"),
    ],
)
def test_le_malgache_recoit_une_reponse_en_malgache(
    message: str, intention: str
) -> None:
    assert reponse_politesse(message) == REPONSES[(intention, "mg")]


@pytest.mark.parametrize(
    "message",
    [
        "Bonjour, quels gâteaux proposez-vous ?",
        "Merci, et pour la formation pâtisserie ?",
        "Salama, ohatrinona ny mofo ?",
        "Avez-vous une salle pour 30 personnes ?",
        "Bonjour je voudrais réserver",
    ],
)
def test_une_vraie_question_n_est_jamais_interceptee(message: str) -> None:
    assert reponse_politesse(message) is None


@pytest.mark.parametrize("message", ["", "   ", "?!", "ok", "plus", "le", "tompoko"])
def test_un_message_vide_ou_fait_de_liants_n_est_pas_une_formule(
    message: str,
) -> None:
    assert reponse_politesse(message) is None


def test_accents_et_apostrophes_sont_normalises() -> None:
    assert reponse_politesse("D'accord, merci !") == REPONSES[("remerciement", "fr")]
