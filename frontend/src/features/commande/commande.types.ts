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
  /** Horodatage ISO 8601 avec fuseau, posé par la base. */
  date_commande: string;
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
 * Commande saisie par un membre du personnel, au comptoir ou à table.
 *
 * **Union discriminée par le chemin d'identification**, miroir du schema
 * serveur : soit une réservation de table, soit une identité invitée, jamais
 * les deux. Le compilateur refuse le mélange, sans attendre le 422.
 *
 * **Aucune identité n'y figure** — ni `id_client`, ni `id_personnel`. Le
 * premier est déduit de la réservation par le serveur, le second du jeton du
 * salarié. Les porter ici inviterait à les envoyer, et permettrait de commander
 * au nom d'autrui ou d'attribuer une commande à un collègue.
 */
export interface CommandePersonnelSurReservation extends CommandeEnvoyee {
  id_reservation: number;
}

export interface CommandePersonnelPourInvite extends CommandeEnvoyee {
  nom_invite: string;
  contact_invite: string;
}

export type CommandePersonnelEnvoyee =
  CommandePersonnelSurReservation | CommandePersonnelPourInvite;

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

/**
 * Acheteur d'une commande saisie par un salarié : l'un ou l'autre, jamais les
 * deux. Miroir des deux chemins du schema serveur.
 */
export type CibleAcheteur =
  { id_reservation: number } | { nom_invite: string; contact_invite: string };

/** Chemin d'identification choisi dans l'écran de prise de commande. */
export type CheminAcheteur = 'reservation' | 'invite';
