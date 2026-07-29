/**
 * Règles du panier : fonctions pures, sans état ni effet.
 *
 * Elles reçoivent un panier et en rendent un nouveau. La persistance et
 * l'abonnement vivent dans `commande.panier.ts`, les composants dans `pages/`.
 * Ce découpage rend ces règles testables sans rendu ni stockage.
 */

import type { LignePanier, LigneCommandeEnvoyee } from './commande.types';
import type { Produit } from '@/features/produit/produit.types';

export const DEVISE = 'Ar';

/**
 * Ajoute un produit, ou augmente sa quantité s'il est déjà au panier.
 *
 * La quantité est bornée par le stock connu : un produit épuisé n'entre pas, et
 * on ne peut pas en demander plus qu'il n'y en a. Ce n'est qu'un garde-fou
 * d'interface — le serveur reste seul juge au moment de la commande, par un
 * décrément atomique.
 */
export function ajouterAuPanier(
  panier: LignePanier[],
  produit: Produit,
  quantite = 1
): LignePanier[] {
  if (produit.stock_disponible <= 0 || quantite <= 0) {
    return panier;
  }

  const existante = panier.find((l) => l.id_produit === produit.id_produit);
  if (existante) {
    return modifierQuantite(panier, produit.id_produit, existante.quantite + quantite);
  }

  return [
    ...panier,
    {
      id_produit: produit.id_produit,
      nom: produit.nom,
      prix_unitaire: produit.prix_unitaire,
      unite_mesure: produit.unite_mesure,
      quantite: Math.min(quantite, produit.stock_disponible),
      stock_disponible: produit.stock_disponible,
    },
  ];
}

/**
 * Fixe la quantité d'une ligne.
 *
 * Une quantité nulle ou négative retire la ligne : c'est le geste attendu quand
 * on vide un champ de quantité, et ça évite une ligne à zéro dans le panier.
 */
export function modifierQuantite(
  panier: LignePanier[],
  idProduit: number,
  quantite: number
): LignePanier[] {
  if (quantite <= 0) {
    return retirerDuPanier(panier, idProduit);
  }
  return panier.map((ligne) =>
    ligne.id_produit === idProduit
      ? { ...ligne, quantite: Math.min(quantite, ligne.stock_disponible) }
      : ligne
  );
}

export function retirerDuPanier(
  panier: LignePanier[],
  idProduit: number
): LignePanier[] {
  return panier.filter((ligne) => ligne.id_produit !== idProduit);
}

/** Nombre d'articles, toutes lignes confondues. Alimente le compteur de la nav. */
export function nombreArticles(panier: LignePanier[]): number {
  return panier.reduce((total, ligne) => total + ligne.quantite, 0);
}

/**
 * Total du panier, **pour l'affichage seulement**.
 *
 * Le montant réellement enregistré est calculé par le serveur à partir des prix
 * du catalogue au moment de la commande. Les deux peuvent diverger si un tarif
 * change entre-temps : c'est assumé, le panier n'engage pas de prix.
 */
export function totalPanier(panier: LignePanier[]): number {
  return panier.reduce(
    (total, ligne) => total + Number(ligne.prix_unitaire) * ligne.quantite,
    0
  );
}

/** Met en forme un montant en Ariary. */
export function formaterMontant(valeur: number | string): string {
  const nombre = Number(valeur);
  if (Number.isNaN(nombre)) {
    return `${valeur} ${DEVISE}`;
  }
  const montant = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(nombre);
  return `${montant} ${DEVISE}`;
}

/**
 * Traduit le panier en lignes de commande.
 *
 * Ne transmet que l'identifiant et la quantité : le prix est déterminé par le
 * serveur. L'envoyer n'aurait aucun effet, le schema d'entrée ne l'expose pas.
 */
export function versLignesEnvoyees(panier: LignePanier[]): LigneCommandeEnvoyee[] {
  return panier.map((ligne) => ({
    id_produit: ligne.id_produit,
    quantite: ligne.quantite,
  }));
}

/**
 * Met en forme une date de commande, dans le même esprit que `formaterMontant`.
 *
 * `Intl` et non un découpage manuel : c'est lui qui connaît l'ordre des
 * composants et les séparateurs du français. La date arrive en UTC et s'affiche
 * dans le fuseau du navigateur — c'est bien l'heure locale du client qui
 * l'intéresse, pas celle du serveur.
 *
 * Une valeur illisible est rendue telle quelle plutôt que sous forme d'« Invalid
 * Date » : mieux vaut une donnée brute qu'un message qui ressemble à un bogue.
 */
export function formaterDate(valeur: string): string {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) {
    return valeur;
  }
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}
