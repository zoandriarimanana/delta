"""Texte indexable d'une CATEGORIE_PRODUIT.

Porte la liste de ses produits actifs : c'est ce fragment qui répond à « que
vendez-vous en boulangerie ? ». Il doit donc être resynchronisé quand un
produit de la catégorie change — `ProduitService` s'en charge.
"""

from app.ai_langchain.synchronisation import (
    assistant_actif,
    recharger_relation,
    synchroniser,
)
from app.models.categorie_produit import CategorieProduit

TYPE_CONTENU = "categorie_produit"


def construire_texte(categorie: CategorieProduit) -> str:
    noms = sorted(p.nom for p in categorie.produits if p.supprime_le is None)
    lignes = [f"Catégorie de produits : {categorie.libelle}"]
    if noms:
        lignes.append("Produits de cette catégorie : " + ", ".join(noms) + ".")
    return "\n".join(lignes)


def est_indexable(categorie: CategorieProduit) -> bool:
    return categorie.supprime_le is None


def synchroniser_categorie_produit(categorie: CategorieProduit) -> None:
    if not assistant_actif():
        return
    recharger_relation(categorie, "produits")
    synchroniser(
        TYPE_CONTENU,
        categorie.id_categorie,
        est_indexable(categorie),
        lambda: construire_texte(categorie),
    )
