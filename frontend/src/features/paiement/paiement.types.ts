/**
 * Types du module paiement, relevés du schéma OpenAPI.
 *
 * Le montant arrive en **chaîne** : c'est un `Decimal` côté serveur, que
 * FastAPI sérialise ainsi pour ne pas perdre de précision au passage par le
 * flottant JSON — même convention que `commande.types.ts`.
 *
 * `methode` et `fournisseur` sont liés côté serveur (8 octobre 2026) : la
 * carte passe par Stripe, le mobile money par un opérateur malgache.
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
  /** `null` pour l'acompte d'une réservation (13 octobre 2026). */
  id_commande: number | null;
  id_reservation?: number | null;
}

/**
 * Charge utile d'initiation. Ni `montant` ni `id_commande` : le premier est
 * figé par le serveur depuis `COMMANDE.montant_total`, le second vient de
 * l'URL (`POST /commandes/{id}/paiements`).
 */
export interface PaiementEnvoye {
  methode: MethodePaiement;
  fournisseur: FournisseurPaiement;
  /**
   * Numéro du portefeuille à débiter, **exigé pour le mobile money** : il
   * reçoit la demande de validation de l'opérateur. Transmis, jamais stocké
   * par le serveur.
   */
  numero_mobile_money?: string;
}

/**
 * Ce qui est payé : la commande d'un client connecté (par son identifiant),
 * celle d'un invité (par sa référence publique, sa seule clé), ou l'acompte
 * d'une réservation (13 octobre 2026).
 */
export type CiblePaiement =
  | { type: 'client'; idCommande: number }
  | { type: 'invite'; reference: string }
  | { type: 'reservation'; idReservation: number };
