/**
 * Types du module commande, relevés du schéma OpenAPI.
 *
 * Les montants arrivent en **chaîne** : ce sont des `Decimal` côté serveur, que
 * FastAPI sérialise ainsi pour ne pas perdre de précision au passage par le
 * flottant JSON. Même convention que `produit.types.ts`.
 */

export type TypeCommande = 'En_ligne' | 'Sur_place' | 'A_emporter';

export type StatutCommande =
  'En_attente' | 'Confirmee' | 'En_preparation' | 'Livree' | 'Servie' | 'Annulee';

export interface LigneCommandeLue {
  id_ligne: number;
  id_produit: number;
  nom_produit: string;
  quantite: number;
  prix_unitaire_applique: string;
}

export interface Commande {
  id_commande: number;
  /**
   * Renseignée **uniquement** pour une commande invitée. C'est l'unique moyen
   * pour l'invité de revenir sur sa commande : il n'a ni compte ni jeton.
   */
  reference_publique: string | null;
  type_commande: TypeCommande;
  statut: StatutCommande;
  montant_total: string;
  id_client: number | null;
  nom_invite: string | null;
  contact_invite: string | null;
  lignes: LigneCommandeLue[];
}

/** Ligne envoyée à la création : le serveur fixe le prix, pas le client. */
export interface LigneCommandeEnvoyee {
  id_produit: number;
  quantite: number;
}

export interface CommandeEnvoyee {
  type_commande: TypeCommande;
  lignes: LigneCommandeEnvoyee[];
}

export interface CommandeInviteEnvoyee extends CommandeEnvoyee {
  nom_invite: string;
  contact_invite: string;
}

/**
 * Ligne du panier, côté client uniquement.
 *
 * Le MLD ne comporte **aucune entité panier** : il n'existe que dans le
 * navigateur jusqu'à la validation, qui crée la `COMMANDE` et ses lignes.
 *
 * `prix_unitaire` y est mémorisé **pour l'affichage seulement**. Le prix
 * réellement facturé est celui que le serveur lit sur `PRODUIT` au moment de la
 * création : le panier est un brouillon, pas un engagement de prix.
 */
export interface LignePanier {
  id_produit: number;
  nom: string;
  prix_unitaire: string;
  unite_mesure: string;
  quantite: number;
  /** Stock connu au moment de l'ajout — sert à borner la quantité saisie. */
  stock_disponible: number;
}
