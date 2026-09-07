/**
 * Types du module paiement, relevés du schéma OpenAPI.
 *
 * Le montant arrive en **chaîne** : c'est un `Decimal` côté serveur, que
 * FastAPI sérialise ainsi pour ne pas perdre de précision au passage par le
 * flottant JSON — même convention que `commande.types.ts`.
 *
 * `methode` et `fournisseur` sont deux domaines **indépendants** : aucune
 * contrainte ne lie l'un à l'autre côté serveur (pas de `CHECK`), donc aucune
 * restriction n'est ajoutée ici — ce serait une règle inventée, pas relevée.
 */

export type MethodePaiement = 'Carte' | 'Mobile_money';

export type FournisseurPaiement = 'Mvola' | 'Orange_money' | 'Airtel_money' | 'Stripe';

export type StatutPaiement = 'En_attente' | 'Reussi' | 'Echoue';

export interface Paiement {
  id_paiement: number;
  montant: string;
  methode: MethodePaiement;
  fournisseur: FournisseurPaiement;
  statut: StatutPaiement;
  reference_externe: string;
  date_paiement: string;
  id_commande: number;
}

/**
 * Charge utile d'initiation. Ni `montant` ni `id_commande` : le premier est
 * figé par le serveur depuis `COMMANDE.montant_total`, le second vient de
 * l'URL (`POST /commandes/{id}/paiements`).
 */
export interface PaiementEnvoye {
  methode: MethodePaiement;
  fournisseur: FournisseurPaiement;
}
