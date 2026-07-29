/**
 * Indique si une session est ouverte, d'après la présence du jeton.
 *
 * Vit dans `lib/` et non dans un module métier : l'état de session n'appartient
 * à aucun d'eux, et plusieurs en dépendent — le tunnel de commande pour choisir
 * son parcours, l'historique pour savoir s'il a quelque chose à demander, la
 * navigation pour n'afficher que des liens utilisables.
 *
 * Ne valide pas le jeton, qui peut être expiré : seul le serveur en juge. Un
 * appel refusé déclenche l'événement `delta:non-authentifie` de `axiosClient`,
 * auquel le routage réagit.
 */

import { lireJeton } from './tokenStorage';

export function useEstConnecte(): boolean {
  return lireJeton() !== null;
}
