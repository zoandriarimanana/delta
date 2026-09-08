/**
 * État de session, par population.
 *
 * Vit dans `lib/` et non dans un module métier : l'état de session n'appartient
 * à aucun d'eux, et plusieurs en dépendent — le tunnel de commande pour choisir
 * son parcours, l'historique pour savoir s'il a quelque chose à demander, la
 * navigation pour n'afficher que des liens utilisables.
 *
 * Ne valide pas le jeton, qui peut être expiré : seul le serveur en juge. Un
 * appel refusé déclenche l'événement `delta:non-authentifie` de `axiosClient`,
 * auquel le routage réagit.
 *
 * **Ces hooks authentifient, ils n'autorisent pas.** Aucun droit ne se dérive
 * ici : `est_administrateur` n'est porté par aucun jeton lisible, et le serveur
 * refuse en 403 ce qui doit l'être. Masquer un bouton est une commodité, jamais
 * une garantie.
 */

import { lireSession, type TypeSujet } from './tokenStorage';

/** Population de la session en cours, ou `null` si aucune n'est ouverte. */
export function useSession(): TypeSujet | null {
  return lireSession()?.type ?? null;
}

/**
 * Vrai si un **client** est connecté.
 *
 * Un salarié connecté rend `false` : les pages client — panier, historique,
 * réservations — ne lui sont pas destinées, et l'API refuserait son jeton avec
 * un 401 qui effacerait sa session de travail.
 */
export function useEstConnecte(): boolean {
  return useSession() === 'client';
}

/** Vrai si un membre du **personnel** est connecté. */
export function useEstPersonnelConnecte(): boolean {
  return useSession() === 'personnel';
}
