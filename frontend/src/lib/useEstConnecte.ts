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
 * **Ces hooks authentifient, ils n'autorisent pas.** Depuis le chantier
 * sidebar, `useEstAdministrateur()` lit bien `est_administrateur` — mais
 * cette valeur ne fait que décider quels liens **afficher**, jamais ce
 * qu'une requête peut faire : le serveur refuse en 403 ce qui doit l'être,
 * quoi que cette valeur vaille côté client. Masquer un lien est une
 * commodité, jamais une garantie.
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
 * Vrai si le salarié connecté porte le droit d'administration.
 *
 * **Affichage uniquement, jamais une garde.** Sert à `LayoutPersonnel` pour
 * décider quels liens montrer dans la sidebar — la section « Gestion » doit
 * être **absente**, pas grisée, pour un salarié qui ne peut pas s'en servir.
 * Ne protège rien : la garantie reste le refus 403 du serveur
 * (`get_current_personnel_administrateur`), inchangée par ce champ. Un
 * client (ou un salarié non connecté) rend systématiquement `false`, comme
 * `lireSession().estAdministrateur` le vaut par défaut.
 */
export function useEstAdministrateur(): boolean {
  return useSyncExternalStore(abonnerALaSession, () => lireSession().estAdministrateur);
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
