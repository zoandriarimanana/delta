/**
 * Devise d'affichage choisie par le visiteur, et sa mémorisation.
 *
 * **Préférence propre à ce navigateur**, rangée en `localStorage` comme le
 * thème : elle ne décide que de l'affichage et de la devise proposée au
 * tunnel. Le montant payé est toujours celui que le serveur fige.
 */

import { useSyncExternalStore } from 'react';

import { DEVISES } from './devise.service';
import type { Devise } from './devise.types';

export const CLE_DEVISE = 'delta.devise';

const abonnes = new Set<() => void>();

function deviseMemorisee(): Devise {
  try {
    const valeur = localStorage.getItem(CLE_DEVISE);
    return DEVISES.includes(valeur as Devise) ? (valeur as Devise) : 'MGA';
  } catch {
    return 'MGA';
  }
}

let courante: Devise = deviseMemorisee();

export function lireDevise(): Devise {
  return courante;
}

/** Choisit la devise, la mémorise et prévient les composants abonnés. */
export function definirDevise(devise: Devise): void {
  courante = devise;
  try {
    localStorage.setItem(CLE_DEVISE, devise);
  } catch {
    // Stockage indisponible : le choix vaut pour la session en cours.
  }
  abonnes.forEach((notifier) => notifier());
}

function abonner(notifier: () => void): () => void {
  abonnes.add(notifier);
  return () => abonnes.delete(notifier);
}

/** Devise courante, réactive. */
export function useDevise(): Devise {
  return useSyncExternalStore(abonner, lireDevise, lireDevise);
}
