/**
 * Types du module commande, relevés du schéma OpenAPI.
 *
 * Les montants arrivent en **chaîne** : ce sont des `Decimal` côté serveur, que
 * FastAPI sérialise ainsi pour ne pas perdre de précision au passage par le
 * flottant JSON. Même convention que `produit.types.ts`.
 */

import type { Devise } from '@/features/devise/devise.types';

export type TypeCommande = 'En_ligne' | 'Sur_place' | 'A_emporter';

export type StatutCommande =
  'En_attente' | 'Confirmee' | 'En_preparation' | 'Livree' | 'Servie' | 'Annulee';

export interface LigneCommandeLue {
  id_ligne: number;
  id_produit: number;
  nom_produit: string;
  quantite: number;
  prix_unitaire_applique: string;
  /** Demande jointe à la ligne, `null`/absente si le produit n'est pas personnalisé. */
  personnalisation?: PersonnalisationLue | null;
  /** Copie de la photo du produit choisie par le client (partie `lignes`). */
  photo_produit?: string | null;
}

/** Miroir de `DemandePersonnalisationRead`. */
export interface PersonnalisationLue {
  description_demande: string;
  ingredients_specifiques: string | null;
  /** Supplément **par unité**, figé à la commande — fixé par le catalogue. */
  supplement_prix: string;
  /** Copie du modèle choisi parmi les exemples de la catégorie (partie `modeles`). */
  photo_modele?: string | null;
}

/**
 * Personnalisation saisie par le client, gardée **structurée** dans le panier
 * pour pouvoir la modifier. Assemblée en un texte lisible à l'envoi
 * (`versPersonnalisationEnvoyee`) : le serveur ne connaît que
 * `description_demande` et `ingredients_specifiques`.
 */
export interface PersonnalisationPanier {
  message: string;
  theme: string;
  precisions: string;
  ingredients: string;
  /** Photo retenue (« Je veux ce modèle »), nom de fichier. */
  modele?: string;
  /** Où elle a été prise : galerie du produit, ou exemples de sa catégorie. */
  modeleSource?: 'produits' | 'categories';
}

/** Miroir de `DemandePersonnalisationCreate` — sans supplément, jamais envoyé. */
export interface PersonnalisationEnvoyee {
  description_demande: string;
  ingredients_specifiques?: string;
  photo_modele?: string;
  source_modele?: 'produits' | 'categories';
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
  /** Frais de livraison compris : produits + `frais_livraison`. */
  montant_total: string;
  /**
   * Frais de livraison **appliqués**, figés à la commande. `"0.00"` sans
   * livraison, ou si elle était offerte (seuil atteint).
   */
  frais_livraison: string;
  /**
   * Adresse saisie au tunnel ; sa présence a créé la livraison. Facultative
   * dans le type : seules les vues qui distinguent livraison et retrait la
   * lisent.
   */
  adresse_livraison?: string | null;
  id_client: number | null;
  nom_invite: string | null;
  contact_invite: string | null;
  lignes: LigneCommandeLue[];
  /**
   * Horodatage d'un remboursement (Sprint 10.6) — `null` tant qu'aucun n'a
   * été posé. Miroir direct de `supprime_le` côté serveur, mais sans lien
   * avec `PAIEMENT` : c'est un geste administratif manuel, pas la trace
   * d'un reversement réel (cf. `docs/mld.md`).
   */
  rembourse_le: string | null;
  /** Archivage (13 octobre 2026) : seule l'administration lit des
   * commandes archivées. */
  supprime_le?: string | null;
  /** Échéance du paiement (13 octobre 2026) : au-delà, la commande est
   * annulée et son stock rendu. `null` si elle n'est pas concernée. */
  paiement_avant?: string | null;
  /**
   * Devise de paiement choisie par le client, taux figé (Ariary par unité)
   * et montant à payer dans cette devise — tous trois fixés par le serveur à
   * la commande (ouverture internationale). `montant_total` reste la
   * référence en Ariary. Facultatifs dans le type : une commande antérieure,
   * ou une vue qui ne les lit pas, vaut une commande en Ariary.
   */
  devise?: Devise;
  taux_change?: string;
  montant_total_devise?: string;
}

/** Ligne envoyée à la création : le serveur fixe le prix, pas le client. */
export interface LigneCommandeEnvoyee {
  id_produit: number;
  quantite: number;
  personnalisation?: PersonnalisationEnvoyee;
  photo_produit?: string;
}

export interface CommandeEnvoyee {
  type_commande: TypeCommande;
  lignes: LigneCommandeEnvoyee[];
  /**
   * Sa présence, et elle seule, crée la `LIVRAISON` et les frais
   * correspondants. Absente : retrait, aucun frais.
   */
  adresse_livraison?: string;
  /**
   * Devise dans laquelle le client paiera. **Seul le choix** est envoyé : le
   * taux et le montant converti sont fixés par le serveur. Absente : Ariary.
   */
  devise?: Devise;
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
  /**
   * Une par ligne, appliquée à **toute** la quantité — comme côté serveur, où
   * la demande est rattachée à la ligne de commande.
   */
  personnalisation?: PersonnalisationPanier;
  /** Photo de la galerie du produit affichée à l'ajout (14 octobre 2026) :
   * c'est elle que le client commande, et elle accompagne la ligne. */
  photo?: string;
  /**
   * Supplément par unité lu au catalogue lors de l'ajout, pour l'affichage
   * seulement : le serveur le relit et le fige à la commande.
   */
  supplement_personnalisation?: string | null;
  /**
   * Vendu à la personne : la ligne est **un** produit pour `quantite`
   * personnes. Sa quantité part du minimum et n'est pas bornée au stock, qui
   * compte des produits entiers.
   */
  vendu_par_personne?: boolean;
  personnes_min?: number | null;
}

/**
 * Acheteur d'une commande saisie par un salarié : l'un ou l'autre, jamais les
 * deux. Miroir des deux chemins du schema serveur.
 */
export type CibleAcheteur =
  { id_reservation: number } | { nom_invite: string; contact_invite: string };

/** Chemin d'identification choisi dans l'écran de prise de commande. */
export type CheminAcheteur = 'reservation' | 'invite';
