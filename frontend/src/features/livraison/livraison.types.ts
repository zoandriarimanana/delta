/**
 * Types du module livraison, relevés du schéma OpenAPI.
 *
 * `SuiviLivraison` reste le miroir de `LivraisonPublique` côté serveur, pour
 * le parcours client — sans identité de livreur. `LivraisonAdministration`
 * (Sprint 10.6) est le premier type qui déclare le pendant `LivraisonRead` :
 * la fiche d'administration d'une commande a besoin de `id_livraison` pour
 * pouvoir relancer une tournée échouée, ce qu'aucun endpoint public ne
 * renvoie. Les deux schémas continuent de vivre côte à côte pour la même
 * raison qu'avant : deux populations, deux frontières de confidentialité
 * (cf. `docs/architecture.md`).
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

/**
 * Livraison telle que le personnel la voit — porte `id_livraison` et
 * `id_commande`, absents de `SuiviLivraison`. Réservé aux endpoints du
 * personnel (`GET /livraisons`, `POST /livraisons/{id}/relance`), jamais
 * exposé sur un chemin public.
 */
export interface LivraisonAdministration {
  id_livraison: number;
  id_commande: number;
  statut: StatutLivraison;
  date_heure_prevue: string | null;
  date_heure_reelle: string | null;
  /** `null` tant qu'aucun livreur n'est affecté. */
  id_personnel: number | null;
}
