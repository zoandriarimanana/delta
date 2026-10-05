"""Texte indexable d'une FORMATION, sessions à venir comprises.

Les sessions ne sont **pas** indexées à part : la fiche d'une session est celle
de sa formation, c'est là que le client doit être renvoyé. Leurs dates et leur
statut entrent donc dans le texte de la formation, qui est resynchronisé à
chaque changement de session (`SessionFormationService`).

Inclus depuis 12.8 : `prix`, fixé par un administrateur. Exclus :
`capacite_max` et `places_restantes` — la seconde est un compteur qui change à
chaque réservation —, et le **formateur**, même si `FormateurPublic` l'expose : un
salarié anonymisé resterait nommé dans l'index.
"""

from datetime import date

from app.ai_langchain.synchronisation import (
    assistant_actif,
    recharger_relation,
    synchroniser,
)
from app.ai_langchain.textes.montant import formater_ariary
from app.models.formation import Formation
from app.models.session_formation import SessionFormation, StatutSessionFormation

TYPE_CONTENU = "formation"

STATUTS_A_VENIR = {
    StatutSessionFormation.PLANIFIEE: "planifiée",
    StatutSessionFormation.OUVERTE: "inscriptions ouvertes",
}


def _sessions_a_venir(
    formation: Formation, aujourd_hui: date
) -> list[SessionFormation]:
    return sorted(
        (
            s
            for s in formation.sessions
            if s.supprime_le is None
            and s.statut in STATUTS_A_VENIR
            and s.date_fin >= aujourd_hui
        ),
        key=lambda s: s.date_debut,
    )


def construire_texte(formation: Formation, aujourd_hui: date | None = None) -> str:
    lignes = [
        f"Formation : {formation.titre}",
        f"Domaine : {formation.domaine.libelle}",
    ]
    if formation.niveau:
        lignes.append(f"Niveau : {formation.niveau}")
    lignes.append(f"Durée : {formation.duree_heures} heures")
    lignes.append(f"Prix : {formater_ariary(formation.prix)} par personne")
    lignes.append(
        "Hébergement proposé pendant la formation."
        if formation.propose_hebergement
        else "Sans hébergement."
    )
    if formation.description:
        lignes.append(f"Présentation : {formation.description}")
    sessions = _sessions_a_venir(formation, aujourd_hui or date.today())
    if sessions:
        lignes.append("Sessions à venir :")
        lignes.extend(
            f"- du {s.date_debut:%d/%m/%Y} au {s.date_fin:%d/%m/%Y}"
            f" ({STATUTS_A_VENIR[s.statut]})"
            for s in sessions
        )
    else:
        lignes.append("Aucune session à venir annoncée pour le moment.")
    return "\n".join(lignes)


def titre(formation: Formation) -> str:
    """Nom affiché dans les sources d'une réponse."""
    return formation.titre


def est_indexable(formation: Formation) -> bool:
    return formation.supprime_le is None


def synchroniser_formation(formation: Formation) -> None:
    if not assistant_actif():
        return
    recharger_relation(formation, "sessions")
    synchroniser(
        TYPE_CONTENU,
        formation.id_formation,
        est_indexable(formation),
        lambda: construire_texte(formation),
        titre(formation),
    )
