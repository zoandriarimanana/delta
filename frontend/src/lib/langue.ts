/**
 * Langue de l'interface — français ou anglais — et sa mémorisation.
 *
 * Ouverture internationale (8 octobre 2026) : l'interface **client** est
 * proposée en anglais ; le back-office reste en français.
 *
 * **Préférence propre à ce navigateur**, rangée en `localStorage` comme le
 * thème. Le français reste la langue par défaut : c'est la langue de Delta,
 * et l'anglais est un choix explicite du visiteur.
 *
 * Les textes ne vivent **pas** ici : chaque module tient les siens dans
 * `<module>.textes.ts`, une version par langue, et les lit avec
 * `useTextes`. Un fichier central de traductions croiserait toutes les
 * entités — le fourre-tout que la SRP interdit.
 */

import { useSyncExternalStore } from 'react';

export type Langue = 'fr' | 'en';

export const LANGUES: Langue[] = ['fr', 'en'];

export const NOMS_LANGUES: Record<Langue, string> = {
  fr: 'Français',
  en: 'English',
};

export const CLE_LANGUE = 'delta.langue';

/** Textes d'un module : une version par langue, de même forme. */
export type Textes<T> = Record<Langue, T>;

const LOCALES: Record<Langue, string> = { fr: 'fr-FR', en: 'en-US' };

const abonnes = new Set<() => void>();

/**
 * **L'interface démarre toujours en français.** Le bouton FR/EN de l'en-tête
 * a été retiré à la demande de l'utilisateur (9 octobre 2026) : sans lui, un
 * choix « anglais » mémorisé auparavant serait impossible à quitter, donc on
 * ne le relit plus. Les textes anglais restent tenus dans chaque module, prêts
 * si le bouton revient.
 */
let courante: Langue = 'fr';

function appliquer(langue: Langue): void {
  document.documentElement.lang = langue;
}

appliquer(courante);

export function lireLangue(): Langue {
  return courante;
}

/** Locale des dates et des nombres (`fr-FR`, `en-US`). */
export function localeCourante(): string {
  return LOCALES[courante];
}

/** Choisit la langue, la mémorise et prévient les composants abonnés. */
export function definirLangue(langue: Langue): void {
  courante = langue;
  appliquer(langue);
  try {
    localStorage.setItem(CLE_LANGUE, langue);
  } catch {
    // Stockage indisponible : le choix vaut pour la session en cours.
  }
  abonnes.forEach((notifier) => notifier());
}

function abonner(notifier: () => void): () => void {
  abonnes.add(notifier);
  return () => abonnes.delete(notifier);
}

/** Langue courante, réactive. */
export function useLangue(): Langue {
  return useSyncExternalStore(abonner, lireLangue, lireLangue);
}

/** Textes d'un module dans la langue courante, réactifs. */
export function useTextes<T>(textes: Textes<T>): T {
  return textes[useLangue()];
}

/**
 * Textes d'un module dans la langue courante, **hors composant** — pour les
 * fonctions pures des `*.service.ts` (libellés de statut…). Non réactif : les
 * pages publiques sont remontées au changement de langue (`MainLayout`).
 */
export function textesCourants<T>(textes: Textes<T>): T {
  return textes[courante];
}
