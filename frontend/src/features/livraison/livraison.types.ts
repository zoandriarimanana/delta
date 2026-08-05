/**
 * Types du module livraison, relevés du schéma OpenAPI.
 *
 * Un seul type de sortie, volontairement : c'est le miroir de
 * `LivraisonPublique` côté serveur. `LivraisonRead`, qui porte l'identité du
 * livreur, n'est **jamais** déclaré ici — le frontend n'a aucun endpoint qui le
 * renvoie, et lui donner un type inviterait à en attendre les champs.
 */

export type StatutLivraison =
  'En_attente' | 'En_cours' | 'Livree' | 'Echouee' | 'Annulee';

/**
 * Suivi tel qu'un client le voit : statut et dates, rien d'autre.
 *
 * Ni `id_personnel`, ni nom, ni contact du livreur, ni adresse. L'absence est
 * garantie côté serveur par un schema de sortie distinct (cf.
 * `docs/architecture.md`) ; ce type la reflète plutôt que de la contredire.
 */
export interface SuiviLivraison {
  statut: StatutLivraison;
  /** `null` tant que la tournée n'est pas planifiée. */
  date_heure_prevue: string | null;
  /** `null` tant que la livraison n'a pas été remise. */
  date_heure_reelle: string | null;
}
