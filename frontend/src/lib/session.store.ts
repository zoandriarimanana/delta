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
  /**
   * Miroir de `SessionActive.est_administrateur` (chantier sidebar) : `false`
   * pour un client ou un salarié sans ce droit, `true` pour un salarié qui le
   * porte. **Affichage uniquement** — sert à décider quels liens montrer dans
   * `LayoutPersonnel`, ne protège rien. La garantie reste, comme partout
   * ailleurs, le refus 403 du serveur (`get_current_personnel_administrateur`).
   */
  estAdministrateur: boolean;
}

const abonnes = new Set<() => void>();

let instantane: Session = { type: null, chargement: true, estAdministrateur: false };

function notifier(): void {
  abonnes.forEach((f) => f());
}

export function lireSession(): Session {
  return instantane;
}

/**
 * Ouvre une session, en remplaçant celle qui existait éventuellement.
 *
 * `estAdministrateur` reste **optionnel** (défaut `false`) : la grande
 * majorité des appelants — connexion client, la plupart des tests — n'ont
 * jamais eu à s'en soucier avant ce chantier, et les obliger à le fournir
 * aurait touché une vingtaine de fichiers sans rapport avec la sidebar. Seuls
 * les appelants qui viennent réellement d'une réponse `SessionActive`
 * personnel (`useInitialiserSession`, `useConnexionPersonnel`) le passent.
 */
export function definirSession(type: TypeSujet, estAdministrateur = false): void {
  instantane = { type, chargement: false, estAdministrateur };
  notifier();
}

/** Ferme la session — ou constate qu'aucune n'était ouverte. */
export function effacerSession(): void {
  instantane = { type: null, chargement: false, estAdministrateur: false };
  notifier();
}

/** Abonnement pour `useSyncExternalStore`. Retourne la fonction de retrait. */
export function abonnerALaSession(notifierAbonne: () => void): () => void {
  abonnes.add(notifierAbonne);
  return () => {
    abonnes.delete(notifierAbonne);
  };
}
