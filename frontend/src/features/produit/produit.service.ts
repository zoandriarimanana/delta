/**
 * Règles d'affichage et de lecture du catalogue.
 *
 * Ce qui vit ici est ce qui a du sens hors de tout composant : la mise en forme
 * d'un prix, la disponibilité d'un produit, le libellé d'une catégorie. Les
 * pages consomment ces fonctions, elles ne les réimplémentent pas.
 */

import type { CategorieProduit, Produit } from './produit.types';

export const DEVISE = 'Ar';

/** Valeur du filtre « toutes catégories », distincte d'un identifiant. */
export const TOUTES_CATEGORIES = 'toutes';

export type FiltreCategorie = number | typeof TOUTES_CATEGORIES;

/**
 * Met en forme le prix d'un produit, unité comprise.
 *
 * `prix_unitaire` arrive en chaîne : la conversion se fait ici, une seule fois,
 * plutôt que dans chaque composant qui l'affiche. Un prix illisible est rendu
 * tel quel plutôt que transformé en `NaN` — mieux vaut afficher une valeur
 * inattendue que masquer une anomalie de données.
 */
export function formaterPrix(produit: Produit): string {
  const valeur = Number(produit.prix_unitaire);
  if (Number.isNaN(valeur)) {
    return `${produit.prix_unitaire} ${DEVISE} / ${produit.unite_mesure}`;
  }
  const montant = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valeur);
  return `${montant} ${DEVISE} / ${produit.unite_mesure}`;
}

/** Un produit est disponible s'il reste du stock. */
export function estDisponible(produit: Produit): boolean {
  return produit.stock_disponible > 0;
}

/**
 * Libellé d'une catégorie à partir de son identifiant.
 *
 * Retourne `undefined` si la catégorie est inconnue du lot fourni — le cas se
 * produit légitimement quand un produit référence une catégorie archivée, que
 * l'API ne liste plus.
 */
export function libelleCategorie(
  categories: CategorieProduit[],
  idCategorie: number
): string | undefined {
  return categories.find((c) => c.id_categorie === idCategorie)?.libelle;
}

/**
 * Traduit la valeur du filtre en argument d'appel API.
 *
 * `undefined` signifie « pas de filtre », ce que `recupererProduits` traduit par
 * l'absence du paramètre de requête.
 */
export function versParametreCategorie(filtre: FiltreCategorie): number | undefined {
  return filtre === TOUTES_CATEGORIES ? undefined : filtre;
}

/**
 * Lit la valeur d'un `<select>` et la ramène dans le domaine du filtre.
 *
 * Une valeur non numérique retombe sur « toutes catégories » plutôt que de
 * produire un `NaN` qui partirait tel quel dans l'URL de la requête.
 */
export function depuisValeurSelect(valeur: string): FiltreCategorie {
  if (valeur === TOUTES_CATEGORIES) {
    return TOUTES_CATEGORIES;
  }
  const identifiant = Number(valeur);
  return Number.isInteger(identifiant) ? identifiant : TOUTES_CATEGORIES;
}
