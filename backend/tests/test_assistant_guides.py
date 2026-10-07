"""Guides versionnés de l'assistant IA (Sprint 12, 12.8/12.10)."""

from app.ai_langchain import guides
from app.ai_langchain.audience import AUDIENCE_CLIENT
from app.ai_langchain.indexation import TAILLE_FRAGMENT


def test_sections_decoupe_sur_les_titres_de_niveau_deux() -> None:
    texte = "# Titre\n\nIntro ignorée\n\n## Commander\nÉtape 1.\n\n## Payer\nÉtape 2.\n"

    assert guides.sections(texte) == ["## Commander\nÉtape 1.", "## Payer\nÉtape 2."]


def test_le_guide_client_existe_et_reste_a_l_audience_client() -> None:
    presents = {guide.fichier: guide for guide in guides.guides_presents()}

    assert "guide_client.md" in presents
    assert presents["guide_client.md"].audience == AUDIENCE_CLIENT


def test_chaque_section_du_guide_client_tient_en_un_fragment() -> None:
    """Une section coupée en deux mêlerait une démarche à la suivante."""
    guide = next(g for g in guides.GUIDES if g.fichier == "guide_client.md")
    sections = guides.sections(guide.chemin.read_text(encoding="utf-8"))

    assert len(sections) >= 10
    assert all(len(section) <= TAILLE_FRAGMENT for section in sections)


def test_le_guide_client_ne_promet_pas_ce_que_le_site_ne_fait_pas() -> None:
    """Relevés dans l'interface en écrivant le guide : à mettre à jour avec
    elle, pas à « améliorer » en promettant davantage."""
    guide = next(g for g in guides.GUIDES if g.fichier == "guide_client.md")
    texte = guide.chemin.read_text(encoding="utf-8")

    assert "contactez Delta : le site ne propose pas encore d'annulation" in texte
    # Personnalisation : disponible sur la fiche produit depuis le 7 octobre
    # 2026 — le guide décrit le geste réel, plus la limite d'avant.
    assert "ne permet pas encore de décrire votre personnalisation" not in texte
    assert "« Personnaliser ce produit »" in texte
