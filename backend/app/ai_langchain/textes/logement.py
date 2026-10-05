"""Texte indexable d'un LOGEMENT.

Exclus : `tarif_nuitee`, et le `statut` lui-même — il décrit l'état du bien, et
l'écrire dans un fragment le figerait. Un logement `Hors_service` est en
revanche **retiré** de l'index : il est sorti de l'offre (`docs/mld.md`).
`En_maintenance` y reste, le bien revient.
"""

from app.ai_langchain.synchronisation import assistant_actif, synchroniser
from app.models.logement import Logement, StatutLogement

TYPE_CONTENU = "logement"


def construire_texte(logement: Logement) -> str:
    return "\n".join(
        [
            f"Hébergement : chambre {logement.type_chambre}",
            # Termes malgaches : sans eux, une question posée en malgache
            # (« Misy trano hatoriana ve ? ») ne retrouvait aucun logement —
            # constaté en calibrant le retriever, 12.3.
            "Trano fandraisam-bahiny, efitra fatoriana.",
            f"Capacité : {logement.capacite} personne(s)",
            "Réservable seul, ou en complément d'une formation qui le propose.",
        ]
    )


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
    )
