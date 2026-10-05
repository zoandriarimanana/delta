"""Texte indexable d'un DOMAINE_FORMATION, avec ses formations actives.

Même raisonnement que `categorie_produit` : resynchronisé quand une formation
du domaine change (`FormationService`).
"""

from app.ai_langchain.synchronisation import (
    assistant_actif,
    recharger_relation,
    synchroniser,
)
from app.models.domaine_formation import DomaineFormation

TYPE_CONTENU = "domaine_formation"


def construire_texte(domaine: DomaineFormation) -> str:
    titres = sorted(f.titre for f in domaine.formations if f.supprime_le is None)
    lignes = [f"Domaine de formation : {domaine.libelle}"]
    if domaine.description:
        lignes.append(domaine.description)
    if titres:
        lignes.append("Formations proposées : " + ", ".join(titres) + ".")
    return "\n".join(lignes)


def est_indexable(domaine: DomaineFormation) -> bool:
    return domaine.supprime_le is None


def synchroniser_domaine_formation(domaine: DomaineFormation) -> None:
    if not assistant_actif():
        return
    recharger_relation(domaine, "formations")
    synchroniser(
        TYPE_CONTENU,
        domaine.id_domaine,
        est_indexable(domaine),
        lambda: construire_texte(domaine),
    )
