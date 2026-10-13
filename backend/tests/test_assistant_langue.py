"""Détection de la langue d'une question (13 octobre 2026)."""

import pytest

from app.ai_langchain.langue import langue_de


@pytest.mark.parametrize(
    ("question", "langue"),
    [
        ("Rahoviana no misokatra ianareo ?", "mg"),
        ("Misy fiofanana momba ny fanaovana mofomamy ve ?", "mg"),
        ("Ohatrinona ny gateau ?", "mg"),
        ("Afaka manafatra tsy misy kaonty ve aho ?", "mg"),
        ("Avez-vous des gâteaux au chocolat ?", "fr"),
        ("Comment payer avec MVola ?", "fr"),
        ("Quels sont vos horaires ?", "fr"),
        ("Do you sell cakes?", "en"),
        ("How can I pay my order?", "en"),
        ("", "fr"),
    ],
)
def test_langue_de(question: str, langue: str) -> None:
    assert langue_de(question) == langue
