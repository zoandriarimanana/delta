/**
 * Persistance du panier et diffusion de ses changements.
 *
 * Le MLD ne comporte **aucune entité panier** : il vit dans le navigateur
 * jusqu'à la validation. Limite connue et assumée — panier perdu au changement
 * d'appareil, et lisible par tout script de la page, comme le jeton.
 *
 * Ce module est un magasin externe minimal plutôt qu'un contexte React. Deux
 * raisons : le compteur de la barre de navigation et la page panier doivent
 * partager le même état sans qu'un fournisseur enveloppe toute l'application,
 * et `useSyncExternalStore` garantit que tous les abonnés voient la même valeur
 * au même rendu.
 *
 * Fichier au-delà de la liste de `docs/architecture.md` (`types` / `api` /
 * `service` / `hooks` / `pages`) : la persistance n'est ni une règle pure ni un
 * hook, la fondre dans l'un des deux les rendrait moins lisibles.
 */

import type { LignePanier } from './commande.types';

const CLE = 'delta.panier';

const abonnes = new Set<() => void>();

/**
 * Cache en mémoire, indispensable à `useSyncExternalStore` : il exige un
 * instantané **stable** entre deux rendus. Relire et reparser `localStorage` à
 * chaque appel rendrait un nouveau tableau à chaque fois, et provoquerait une
 * boucle de rendu infinie.
 */
let instantane: LignePanier[] = relireDepuisStockage();

function relireDepuisStockage(): LignePanier[] {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut === null) {
      return [];
    }
    const analyse: unknown = JSON.parse(brut);
    return Array.isArray(analyse) ? (analyse as LignePanier[]) : [];
  } catch {
    // Contenu corrompu ou stockage indisponible : on repart d'un panier vide
    // plutôt que de casser toute l'application au chargement.
    return [];
  }
}

export function lirePanier(): LignePanier[] {
  return instantane;
}

export function ecrirePanier(lignes: LignePanier[]): void {
  instantane = lignes;
  try {
    localStorage.setItem(CLE, JSON.stringify(lignes));
  } catch {
    // Quota dépassé ou stockage refusé : le panier reste utilisable pour la
    // session en cours, il ne survivra simplement pas au rechargement.
  }
  abonnes.forEach((notifier) => notifier());
}

export function viderPanier(): void {
  ecrirePanier([]);
}

/** Abonnement pour `useSyncExternalStore`. Retourne la fonction de retrait. */
export function abonnerAuPanier(notifier: () => void): () => void {
  abonnes.add(notifier);
  return () => {
    abonnes.delete(notifier);
  };
}

/**
 * Recharge depuis le stockage et prévient les abonnés.
 *
 * Sert à l'événement `storage`, émis quand **un autre onglet** modifie le
 * panier : sans ça, deux onglets ouverts divergeraient silencieusement.
 */
export function resynchroniserPanier(): void {
  instantane = relireDepuisStockage();
  abonnes.forEach((notifier) => notifier());
}
