/**
 * Types du module devise (ouverture internationale, 8 octobre 2026).
 *
 * Les taux arrivent en **chaîne** : ce sont des `Decimal` côté serveur,
 * sérialisés ainsi pour ne rien perdre au passage par le flottant JSON —
 * même convention que `commande.types.ts`.
 */

/** Codes ISO 4217 acceptés — liste fermée, comme côté serveur. */
export type Devise = 'MGA' | 'EUR' | 'USD';

export interface TauxChange {
  /** Devise étrangère : l'Ariary n'a pas de ligne, son taux vaut 1. */
  devise: Exclude<Devise, 'MGA'>;
  /** Ariary pour une unité de la devise. */
  ariary_par_unite: string;
  mis_a_jour_le: string;
}
