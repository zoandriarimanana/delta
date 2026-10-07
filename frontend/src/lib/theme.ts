/**
 * Thème d'affichage — clair ou sombre — et sa mémorisation.
 *
 * **Préférence de confort, propre à ce navigateur** : rangée en
 * `localStorage`, jamais sur le serveur ni dans le compte. Sans choix
 * explicite, le thème suit le réglage du système. Tout accès au stockage est
 * protégé : navigation privée ou stockage bloqué ne doivent rien casser.
 *
 * Le thème s'applique par la classe `dark` sur `<html>` ; `index.css`
 * redéfinit alors les couleurs par rôle. Le script de `index.html` pose la
 * même classe **avant** le premier affichage, pour éviter un éclair blanc —
 * il lit la même clé, d'où `CLE_THEME` exportée.
 */

import { useSyncExternalStore } from 'react';

export type Theme = 'clair' | 'sombre';

export const CLE_THEME = 'delta.theme';

const abonnes = new Set<() => void>();

function themeSysteme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'sombre'
      : 'clair';
  } catch {
    return 'clair';
  }
}

function themeMemorise(): Theme | null {
  try {
    const valeur = localStorage.getItem(CLE_THEME);
    return valeur === 'clair' || valeur === 'sombre' ? valeur : null;
  } catch {
    return null;
  }
}

let courant: Theme = themeMemorise() ?? themeSysteme();

function appliquer(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'sombre');
}

appliquer(courant);

export function lireTheme(): Theme {
  return courant;
}

/** Choisit un thème, le mémorise et prévient les composants abonnés. */
export function definirTheme(theme: Theme): void {
  courant = theme;
  appliquer(theme);
  try {
    localStorage.setItem(CLE_THEME, theme);
  } catch {
    // Stockage indisponible : le choix vaut pour la session en cours.
  }
  abonnes.forEach((notifier) => notifier());
}

function abonner(notifier: () => void): () => void {
  abonnes.add(notifier);
  return () => abonnes.delete(notifier);
}

/** Thème courant et bascule, pour l'interrupteur de l'en-tête. */
export function useTheme(): { theme: Theme; basculer: () => void } {
  const theme = useSyncExternalStore(abonner, lireTheme, lireTheme);
  return {
    theme,
    basculer: () => definirTheme(theme === 'sombre' ? 'clair' : 'sombre'),
  };
}
