"""Texte indexable d'un LOGEMENT.

Inclus depuis 12.8 : `tarif_nuitee`, fixé par un administrateur. Exclu : le
`statut` lui-même — il décrit l'état du bien, et
l'écrire dans un fragment le figerait. Un logement `Hors_service` est en
revanche **retiré** de l'index : il est sorti de l'offre (`docs/mld.md`).
`En_maintenance` y reste, le bien revient.
"""

from app.ai_langchain.synchronisation import assistant_actif, synchroniser
from app.ai_langchain.textes.montant import formater_ariary
from app.models.logement import Logement, StatutLogement

TYPE_CONTENU = "logement"


def construire_texte(logement: Logement) -> str:
    lignes = [
        f"Hébergement : chambre {logement.type_chambre}",
        # Termes malgaches : sans eux, une question posée en malgache
        # (« Misy trano hatoriana ve ? ») ne retrouvait aucun logement —
        # constaté en calibrant le retriever, 12.3.
        "Trano fandraisam-bahiny, efitra fatoriana.",
        f"Capacité : {logement.capacite} personne(s)",
        f"Tarif : {formater_ariary(logement.tarif_nuitee)} la nuit",
        "Réservable seul, ou en complément d'une formation qui le propose.",
    ]
    if logement.description:
        lignes.append(f"Présentation : {logement.description}")
    return "\n".join(lignes)


def titre(logement: Logement) -> str:
    """Nom affiché dans les sources d'une réponse."""
    return f"Chambre {logement.type_chambre}"


def est_indexable(logement: Logement) -> bool:
    return (
        logement.supprime_le is None and logement.statut != StatutLogement.HORS_SERVICE
    )


def synchroniser_logement(logement: Logement) -> None:
    if not assistant_actif():
        return
    synchroniser(
        TYPE_CONTENU,
        logement.id_logement,
        est_indexable(logement),
        lambda: construire_texte(logement),
        titre(logement),
    )
