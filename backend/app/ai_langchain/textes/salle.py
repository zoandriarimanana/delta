"""Texte indexable d'une SALLE.

Inclus depuis 12.8 : `tarif_horaire` et `tarif_journee`, fixés par un
administrateur. La capacité, propriété stable du bien, est gardée : c'est
elle qui répond à « une salle pour 30 personnes ? ».
La disponibilité d'un créneau, elle, ne se déduit que des réservations — jamais
de l'index.
"""

from app.ai_langchain.synchronisation import assistant_actif, synchroniser
from app.ai_langchain.textes.montant import formater_ariary
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
    if salle.description:
        lignes.append(f"Présentation : {salle.description}")
    # Le CHECK de SALLE garantit qu'au moins un tarif est renseigné ; `0.00`
    # est une gratuité décidée, pas une absence (docs/mld.md).
    tarifs = [
        f"{mode} : {formater_ariary(tarif)}" if tarif > 0 else f"{mode} : gratuit"
        for mode, tarif in (
            ("à l'heure", salle.tarif_horaire),
            ("à la journée", salle.tarif_journee),
        )
        if tarif is not None
    ]
    if tarifs:
        lignes.append("Location " + " ; ".join(tarifs) + ".")
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
