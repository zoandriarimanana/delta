/** Types du tableau de bord, relevés du schéma OpenAPI (14 octobre 2026). */

export type Periode = '7j' | '30j' | '12m' | 'tout';

/** Miroir de `VenteProduitRead`. */
export interface VenteProduit {
  id_produit: number;
  nom: string;
  categorie: string;
  unites_vendues: number;
  /** Décimal sérialisé en chaîne par l'API. */
  chiffre_affaires: string;
  nombre_commandes: number;
}

/** Miroir de `InscriptionsFormationRead`. */
export interface InscriptionsFormation {
  id_formation: number;
  titre: string;
  /** Personnes inscrites. */
  inscrits: number;
  chiffre_affaires: string;
  nombre_reservations: number;
}

/** Miroir de `PointVentes` : un jour, ou un mois (son premier jour). */
export interface PointVentes {
  /** Date ISO `AAAA-MM-JJ`. */
  debut: string;
  nombre_commandes: number;
  chiffre_affaires: string;
}

/** Miroir de `VentesCategorie`. */
export interface VentesCategorie {
  categorie: string;
  unites_vendues: number;
  chiffre_affaires: string;
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
  pas: 'jour' | 'mois';
  /** Périodes sans vente à zéro. */
  evolution: PointVentes[];
  categories: VentesCategorie[];
  /** Réservations de formation confirmées ou honorées sur la période. */
  formations: InscriptionsFormation[];
}
