"""Texte indexable d'une SALLE.

Exclus : `tarif_horaire` et `tarif_journee`. La capacité, propriété stable du
bien, est gardée : c'est elle qui répond à « une salle pour 30 personnes ? ».
La disponibilité d'un créneau, elle, ne se déduit que des réservations — jamais
de l'index.
"""

from app.ai_langchain.synchronisation import assistant_actif, synchroniser
from app.models.salle import Salle

TYPE_CONTENU = "salle"


def construire_texte(salle: Salle) -> str:
    lignes = [
        f"Salle à louer : {salle.nom}",
        # Terme malgache, même raison que pour LOGEMENT : sans lui, une
        # question en malgache passait sous le seuil de pertinence (12.3).
        "Efitrano fivoriana hofaina.",
        f"Capacité : jusqu'à {salle.capacite} personnes",
    ]
    if salle.equipements:
        lignes.append(f"Équipements : {salle.equipements}")
    # Le mode de location se déduit des tarifs renseignés — sans jamais en
    # donner le montant. Le CHECK de SALLE garantit qu'il y en a au moins un.
    modes = [
        mode
        for mode, tarif in (
            ("à l'heure", salle.tarif_horaire),
            ("à la journée", salle.tarif_journee),
        )
        if tarif is not None
    ]
    if modes:
        lignes.append("Location " + " ou ".join(modes) + ".")
    return "\n".join(lignes)


def titre(salle: Salle) -> str:
    """Nom affiché dans les sources d'une réponse."""
    return salle.nom


def est_indexable(salle: Salle) -> bool:
    return salle.supprime_le is None


def synchroniser_salle(salle: Salle) -> None:
    if not assistant_actif():
        return
    synchroniser(
        TYPE_CONTENU,
        salle.id_salle,
        est_indexable(salle),
        lambda: construire_texte(salle),
        titre(salle),
    )
