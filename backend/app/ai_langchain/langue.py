"""Langue d'une question de visiteur : français, malgache ou anglais.

Une détection volontairement simple, par mots-outils : elle ne sert qu'à
choisir la langue des **réponses toutes faites** (« rien trouvé ») et à
décider de traduire une question malgache avant une seconde recherche. La
réponse du LLM, elle, suit la consigne du prompt.

Ajoutée le 13 octobre 2026 : le message « Je n'ai pas trouvé… » sortait en
français à une question posée en malgache.
"""

from typing import Literal

from app.ai_langchain.politesse import VOCABULAIRE_MG, mots_normalises

Langue = Literal["fr", "mg", "en"]

# Mots-outils et mots très courants, sous forme normalisée (sans accents ni
# apostrophes). Aucun n'est un mot français ou anglais courant.
MARQUEURS_MG = VOCABULAIRE_MG | {
    "ve", "aho", "ianao", "ianareo", "izahay", "isika", "misy", "tsy", "inona",
    "aiza", "firy", "ohatrinona", "rahoviana", "iza", "mba", "azafady", "mila",
    "afaka", "ary", "dia", "no", "ho", "hoe", "ireo", "izany", "ity", "eny",
    "tsia", "olona", "vidiny", "momba", "manafatra", "mividy", "mandoa",
    "fandoavana", "kaonty", "mofomamy", "mofo", "fiofanana", "efitrano",
    "trano", "hatoriana", "hanofa", "mandefa", "misokatra", "amin",
    "aminny", "anareo", "anay", "inty", "izao", "ahoana",
}  # fmt: skip
MARQUEURS_EN = {
    "the", "do", "does", "you", "your", "is", "are", "what", "how", "can",
    "my", "where", "when", "which", "have", "order", "pay", "price", "much",
    "sell", "any", "there", "book", "with", "without", "account",
}  # fmt: skip


def langue_de(texte: str) -> Langue:
    """Langue majoritaire des mots-outils reconnus ; français par défaut."""
    mots = mots_normalises(texte)
    malgache = sum(mot in MARQUEURS_MG for mot in mots)
    anglais = sum(mot in MARQUEURS_EN for mot in mots)
    if malgache and malgache >= anglais:
        return "mg"
    if anglais >= 2 or (anglais and len(mots) <= 3):
        return "en"
    return "fr"


MESSAGES_SANS_RESULTAT: dict[Langue, str] = {
    "fr": (
        "Je n'ai pas trouvé d'information sur ce sujet. "
        "N'hésitez pas à contacter Delta directement."
    ),
    "mg": (
        "Tsy nahitana fanazavana momba izany aho. "
        "Aza misalasala mifandray mivantana amin'i Delta."
    ),
    "en": (
        "I couldn't find any information on this topic. "
        "Feel free to contact Delta directly."
    ),
}


def message_sans_resultat(question: str) -> str:
    """« Rien trouvé », dans la langue de la question."""
    return MESSAGES_SANS_RESULTAT[langue_de(question)]
