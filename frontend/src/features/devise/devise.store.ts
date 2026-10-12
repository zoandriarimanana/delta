/**
 * Devise de **paiement** choisie au tunnel (« Payer en »).
 *
 * Elle ne décide que de la devise dans laquelle la commande est figée et
 * payée — jamais des prix affichés, toujours en Ariary (12 octobre 2026).
 * Plus mémorisée d'une visite à l'autre : un client qui a payé une fois en
 * dollars retrouve l'Ariary, et le mobile money, à sa commande suivante.
 * L'ancienne clé `localStorage` est effacée au chargement.
 */

import { useSyncExternalStore } from 'react';

import { DEVISES } from './devise.service';
import type { Devise } from './devise.types';

export const CLE_DEVISE = 'delta.devise';

const abonnes = new Set<() => void>();

try {
  localStorage.removeItem(CLE_DEVISE);
} catch {
  // Stockage indisponible : rien à effacer.
}

let courante: Devise = 'MGA';

export function lireDevise(): Devise {
  return courante;
}

/** Choisit la devise de paiement et prévient les composants abonnés. */
export function definirDevise(devise: Devise): void {
  if (!DEVISES.includes(devise)) return;
  courante = devise;
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
