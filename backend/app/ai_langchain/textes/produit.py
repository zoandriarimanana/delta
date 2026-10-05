"""Texte indexable d'un PRODUIT.

Exclus : `prix_unitaire`, `stock_disponible` et `supplement_personnalisation`
— valeurs qui changent, que la fiche affiche à jour.
"""

from app.ai_langchain.synchronisation import assistant_actif, synchroniser
from app.models.produit import Produit

TYPE_CONTENU = "produit"


def construire_texte(produit: Produit) -> str:
    """Nom, catégorie, description et modalités — rien de chiffré."""
    lignes = [
        f"Produit : {produit.nom}",
        f"Catégorie : {produit.categorie.libelle}",
    ]
    if produit.description:
        lignes.append(f"Description : {produit.description}")
    lignes.append(f"Vendu par : {produit.unite_mesure}")
    lignes.append(
        "Personnalisable sur demande."
        if produit.est_personnalisable
        else "Non personnalisable."
    )
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
