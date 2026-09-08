/**
 * État de session, par population.
 *
 * Vit dans `lib/` et non dans un module métier : l'état de session n'appartient
 * à aucun d'eux, et plusieurs en dépendent — le tunnel de commande pour choisir
 * son parcours, l'historique pour savoir s'il a quelque chose à demander, la
 * navigation pour n'afficher que des liens utilisables.
 *
 * Depuis T0.10, la source n'est plus une lecture synchrone de `localStorage`
 * mais un magasin réactif (`session.store.ts`), peuplé de façon asynchrone par
 * `GET /auth/moi` au chargement de l'application — le cookie qui porte la
 * session est `httpOnly`, invisible en JS. `useEstConnecte`/
 * `useEstPersonnelConnecte` restent volontairement des hooks **booléens** :
 * la quasi-totalité de leurs appelants n'ont besoin de rien de plus, et durant
 * la brève fenêtre de chargement, lire `false` n'y a qu'un coût cosmétique
 * (un lien de navigation qui apparaît un instant plus tard). Seuls
 * `RoutePersonnel` et `MesReservationsPage` — qui conditionnent respectivement
 * une redirection et un chargement de données sur cet état — ont besoin de
 * distinguer « pas connecté » de « pas encore su » : `useChargementSession`
 * leur est réservé.
 *
 * Ne valide pas le jeton, qui peut être expiré : seul le serveur en juge. Un
 * appel refusé déclenche l'événement `delta:non-authentifie` de `axiosClient`,
 * auquel le routage réagit.
 *
 * **Ces hooks authentifient, ils n'autorisent pas.** Aucun droit ne se dérive
 * ici : `est_administrateur` n'est porté par aucune réponse de session lisible
 * ici, et le serveur refuse en 403 ce qui doit l'être. Masquer un bouton est
 * une commodité, jamais une garantie.
 */

import { useSyncExternalStore } from 'react';

import type { TypeSujet } from '@/features/auth/auth.types';

import { abonnerALaSession, lireSession } from './session.store';

/** Population de la session en cours, ou `null` si aucune n'est ouverte. */
export function useSession(): TypeSujet | null {
  return useSyncExternalStore(abonnerALaSession, () => lireSession().type);
}

/**
 * Vrai si un **client** est connecté.
 *
 * Un salarié connecté rend `false` : les pages client — panier, historique,
 * réservations — ne lui sont pas destinées, et l'API refuserait sa requête avec
 * un 401 qui effacerait sa session de travail.
 */
export function useEstConnecte(): boolean {
  return useSession() === 'client';
}

/** Vrai si un membre du **personnel** est connecté. */
export function useEstPersonnelConnecte(): boolean {
  return useSession() === 'personnel';
}

/**
 * Vrai tant que la vérification initiale de session (`GET /auth/moi`) n'a pas
 * encore répondu.
 *
 * Réservé aux deux appelants qui ne peuvent pas se contenter d'un flash
 * cosmétique : `RoutePersonnel` (une redirection prématurée renverrait un
 * salarié réellement connecté vers l'écran de connexion) et
 * `MesReservationsPage` (qui saute le chargement de ses données tant qu'elle
 * lit « pas connecté », affichant à tort le message d'invitation à se
 * connecter à un client déjà connecté).
 */
export function useChargementSession(): boolean {
  return useSyncExternalStore(abonnerALaSession, () => lireSession().chargement);
}
