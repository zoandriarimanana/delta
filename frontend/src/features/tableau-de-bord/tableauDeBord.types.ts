/** Types du tableau de bord, relevés du schéma OpenAPI (14 octobre 2026). */

export type Periode = '7j' | '30j' | '12m' | 'tout';

/** Miroir de `VenteProduitRead`. */
export interface VenteProduit {
  id_produit: number;
  nom: string;
  unites_vendues: number;
  /** Décimal sérialisé en chaîne par l'API. */
  chiffre_affaires: string;
  nombre_commandes: number;
}

/** Miroir de `TableauDeBordRead`. */
export interface TableauDeBord {
  periode: Periode;
  chiffre_affaires: string;
  nombre_commandes: number;
  panier_moyen: string;
  /** Toutes périodes : ce qui attend une décision. */
  commandes_a_confirmer: number;
  /** Produits vendus sur la période, par quantité décroissante. */
  produits: VenteProduit[];
}
