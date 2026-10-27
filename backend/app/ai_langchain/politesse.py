"""Garde de politesse, en amont de la chaîne RAG.

Une formule de politesse seule — « bonjour », « merci », « veloma » — ne
ressemble à aucun passage du catalogue : l'envoyer au retriever puis au LLM
coûterait un appel facturé pour une réponse qu'on connaît d'avance, et le
retriever, faute de mieux, remonterait des fragments sans rapport.

**La règle est stricte : tous les mots du message doivent appartenir au
vocabulaire de politesse.** Un seul mot hors vocabulaire — « Bonjour, quels
gâteaux avez-vous ? » — et le message part au RAG comme une vraie question.
Mieux vaut un appel de trop qu'une question ignorée.

Trois langues, celles des visiteurs attendus : français, malgache, anglais. La
réponse est donnée en malgache si le message contient un mot malgache, en
anglais s'il n'est fait que de mots anglais (interface client en anglais
depuis le 8 octobre 2026), en français sinon.
"""

import re
import unicodedata

SALUTATIONS_FR_EN = {
    "bonjour",
    "bonsoir",
    "salut",
    "coucou",
    "hello",
    "hi",
    "hey",
}
REMERCIEMENTS_FR_EN = {"merci", "thanks", "thank", "you"}
AU_REVOIR_FR_EN = {"revoir", "bientot", "bye", "ciao", "goodbye"}
# Mots qui accompagnent une formule sans en changer le sens.
LIANTS_FR = {
    "au",
    "a",
    "beaucoup",
    "bien",
    "bonne",
    "journee",
    "soiree",
    "plus",
    "tout",
    "le",
    "monde",
    "vous",
    "ok",
    "daccord",
    "tres",
    "madame",
    "monsieur",
}

SALUTATIONS_MG = {"salama", "manao", "ahoana", "tompoko", "daholo", "akory"}
REMERCIEMENTS_MG = {"misaotra", "betsaka", "indrindra", "tompoko"}
# « amin'ny » devient « aminny » une fois l'apostrophe fusionnée (cf. `_mots`).
AU_REVOIR_MG = {"veloma", "mandra", "pihaona", "amin", "aminny", "ny", "manaraka"}

VOCABULAIRE_MG = SALUTATIONS_MG | REMERCIEMENTS_MG | AU_REVOIR_MG
#: Mots propres à l'anglais : un message fait **uniquement** de ceux-ci reçoit
#: sa réponse en anglais (« hello », « thank you », « bye »).
VOCABULAIRE_EN = {"hello", "hi", "hey", "thanks", "thank", "you", "bye", "goodbye"}
VOCABULAIRE = (
    SALUTATIONS_FR_EN
    | REMERCIEMENTS_FR_EN
    | AU_REVOIR_FR_EN
    | LIANTS_FR
    | VOCABULAIRE_MG
)

REPONSES = {
    ("salutation", "fr"): (
        "Bonjour ! Je suis l'assistant de Delta. Posez-moi vos questions sur "
        "nos produits, nos formations, nos salles ou nos logements."
    ),
    ("remerciement", "fr"): (
        "Avec plaisir ! N'hésitez pas si vous avez une autre question."
    ),
    ("au_revoir", "fr"): "Au revoir, et à bientôt chez Delta !",
    ("salutation", "mg"): (
        "Salama tompoko ! Izaho no mpanampy an'i Delta. Manontania momba ny "
        "vokatra, ny fiofanana, ny efitrano na ny trano fandraisam-bahiny."
    ),
    ("remerciement", "mg"): "Tsy misy fisaorana ! Manontania raha mbola misy.",
    ("au_revoir", "mg"): "Veloma tompoko, mandra-pihaona amin'ny manaraka !",
    ("salutation", "en"): (
        "Hello! I am Delta's assistant. Ask me anything about our products, "
        "training, rooms or accommodation."
    ),
    ("remerciement", "en"): "You're welcome! Feel free to ask another question.",
    ("au_revoir", "en"): "Goodbye, and see you soon at Delta!",
}


def _mots(message: str) -> list[str]:
    """Minuscules, sans accents ni ponctuation, apostrophes fusionnées.

    `d'accord` devient `daccord`, `mandra-pihaona` devient deux mots : le
    vocabulaire est écrit sous cette forme normalisée.
    """
    sans_accents = (
        unicodedata.normalize("NFKD", message.lower())
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    sans_apostrophes = re.sub(r"['’]", "", sans_accents)
    return re.findall(r"[a-z]+", sans_apostrophes)


def mots_normalises(message: str) -> list[str]:
    """Mots d'un message sous la forme du vocabulaire — partagé avec la
    détection de langue (`langue.py`), pour qu'une seule normalisation
    existe."""
    return _mots(message)


def reponse_politesse(message: str) -> str | None:
    """Réponse toute prête si le message n'est qu'une formule de politesse.

    Retourne `None` dès qu'un mot sort du vocabulaire — le message est alors
    une vraie question, à traiter par la chaîne RAG.
    """
    mots = _mots(message)
    if not mots or any(mot not in VOCABULAIRE for mot in mots):
        return None

    ensemble = set(mots)
    # Des liants seuls (« ok », « plus », « le ») ne sont pas une formule :
    # ils ne disent rien, mieux vaut laisser le RAG répondre qu'il ne sait pas.
    if not ensemble - LIANTS_FR - {"ny", "amin", "aminny", "manaraka", "tompoko"}:
        return None
    if ensemble & VOCABULAIRE_MG:
        langue = "mg"
    elif ensemble <= VOCABULAIRE_EN:
        langue = "en"
    else:
        langue = "fr"
    if ensemble & (AU_REVOIR_FR_EN | {"veloma", "pihaona"}):
        intention = "au_revoir"
    elif ensemble & (REMERCIEMENTS_FR_EN | {"misaotra"}):
        intention = "remerciement"
    else:
        intention = "salutation"
    return REPONSES[(intention, langue)]
