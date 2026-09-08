/**
 * Vérifie, une fois au chargement de l'application, si une session est déjà
 * ouverte (T0.10).
 *
 * Composant dédié plutôt qu'un appel direct du hook dans `App.tsx` : celui-ci
 * ne porte que le routeur et la table de routes, rien d'autre — même
 * raisonnement que `SessionExpiree`, à côté duquel ce composant est monté,
 * hors de `<Routes>`.
 *
 * Ne rend rien : c'est un effet, pas un élément d'interface.
 */

import { useInitialiserSession } from '@/features/auth/auth.hooks';

export default function InitialisationSession() {
  useInitialiserSession();
  return null;
}
