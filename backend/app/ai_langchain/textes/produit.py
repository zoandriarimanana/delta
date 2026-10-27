"""Texte indexable d'un PRODUIT.

Inclus depuis 12.8 : `prix_unitaire` et `supplement_personnalisation`, fixés
par un administrateur — leur modification resynchronise l'index. Exclu :
`stock_disponible`, qui change à chaque commande.
"""

from app.ai_langchain.synchronisation import assistant_actif, synchroniser
from app.ai_langchain.textes.montant import formater_ariary
from app.models.produit import Produit

TYPE_CONTENU = "produit"


def construire_texte(produit: Produit) -> str:
    """Nom, catégorie, description, prix et modalités — jamais le stock."""
    lignes = [
        f"Produit : {produit.nom}",
        f"Catégorie : {produit.categorie.libelle}",
        # Termes malgaches, même raison que pour LOGEMENT : l'index est en
        # français, une question en malgache (« mofomamy », « mividy ») ne
        # retrouvait pas les produits (13 octobre 2026).
        "Vokatra azo vidiana sy kaomandina (mofomamy, mofo, sakafo).",
    ]
    if produit.description:
        lignes.append(f"Description : {produit.description}")
    # Vendu à la personne : l'unité est la personne, quel que soit
    # `unite_mesure`, et le minimum fait partie de l'offre.
    par_personne = produit.vendu_par_personne
    unite = "personne" if par_personne else produit.unite_mesure
    lignes.append(f"Prix : {formater_ariary(produit.prix_unitaire)} par {unite}")
    if par_personne:
        lignes.append(
            "Vendu à la personne : le client choisit le nombre de personnes, "
            f"à partir de {produit.personnes_min} personnes."
        )
    if produit.est_personnalisable:
        supplement = produit.supplement_personnalisation
        detail = (
            f", supplément de {formater_ariary(supplement)} par {unite}"
            if supplement is not None
            else ""
        )
        lignes.append(f"Personnalisable{detail}.")
    else:
        lignes.append("Non personnalisable.")
    lignes.append(
        "Livrable."
        if produit.est_livrable
        else "Non livrable : retrait sur place uniquement."
    )
    return "\n".join(lignes)


def titre(produit: Produit) -> str:
    """Nom affiché dans les sources d'une réponse."""
    return produit.nom


def est_indexable(produit: Produit) -> bool:
    return produit.supprime_le is None


def synchroniser_produit(produit: Produit) -> None:
    if not assistant_actif():
        return
    synchroniser(
        TYPE_CONTENU,
        produit.id_produit,
        est_indexable(produit),
        lambda: construire_texte(produit),
        titre(produit),
    )
