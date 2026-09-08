/**
 * État de session partagé, réactif (dette T0.10).
 *
 * Remplace `tokenStorage.ts` : depuis que le jeton est un cookie `httpOnly`
 * posé par le serveur, il n'y a plus rien à lire ni à écrire côté script — le
 * navigateur le porte de façon invisible. Ce qui reste à faire tenir ici,
 * c'est la **population de la session en cours**, connue soit par déduction
 * de l'endpoint qui vient de répondre (connexion réussie), soit par un appel
 * explicite à `GET /auth/moi` (chargement de l'application, cookie invisible
 * en JS).
 *
 * Magasin externe minimal (`useSyncExternalStore`), même patron que
 * `features/commande/commande.panier.ts` : le compteur de session doit être
 * lu par plusieurs endroits (navigation, garde de route, pages) sans qu'un
 * fournisseur enveloppe toute l'application. Contrairement au panier, rien
 * n'est persisté en `localStorage` — la source de vérité est le cookie,
 * inaccessible en JS par construction ; ce magasin n'est qu'un **cache de ce
 * que le serveur a dit pour la dernière fois**, jamais une source de vérité
 * autonome.
 *
 * N'appelle lui-même aucune API : `features/auth/auth.hooks.ts` orchestre
 * `GET /auth/moi` et `POST /auth/deconnexion`, et n'écrit ici que le
 * résultat. Ce fichier reste un magasin pur, comme `commande.panier.ts`
 * reste une persistance pure sans logique de panier.
 */

import type { TypeSujet } from '@/features/auth/auth.types';

export interface Session {
  type: TypeSujet | null;
  /**
   * Vrai tant que `GET /auth/moi` n'a pas encore répondu au chargement de
   * l'application. Distinct de `type === null` : les deux se lisent « pas
   * connecté » pour la plupart des appelants, mais un petit nombre de pages
   * doivent les distinguer pour ne pas afficher un état trompeur pendant la
   * vérification (voir `useChargementSession`, `lib/useEstConnecte.ts`).
   */
  chargement: boolean;
}

const abonnes = new Set<() => void>();

let instantane: Session = { type: null, chargement: true };

function notifier(): void {
  abonnes.forEach((f) => f());
}

export function lireSession(): Session {
  return instantane;
}

/** Ouvre une session, en remplaçant celle qui existait éventuellement. */
export function definirSession(type: TypeSujet): void {
  instantane = { type, chargement: false };
  notifier();
}

/** Ferme la session — ou constate qu'aucune n'était ouverte. */
export function effacerSession(): void {
  instantane = { type: null, chargement: false };
  notifier();
}

/** Abonnement pour `useSyncExternalStore`. Retourne la fonction de retrait. */
export function abonnerALaSession(notifierAbonne: () => void): () => void {
  abonnes.add(notifierAbonne);
  return () => {
    abonnes.delete(notifierAbonne);
  };
}
