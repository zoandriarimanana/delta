/**
 * Garde de route : réserve une page au personnel connecté.
 *
 * Vit dans `lib/` et non dans `features/auth/` : elle ne porte aucune logique
 * d'authentification — elle lit un état de session et choisit quoi rendre. Tout
 * module ayant une page réservée en dépend, aucun ne la possède.
 *
 * **Cette garde n'est pas une protection.** Elle évite d'afficher une page
 * inutilisable ; ce qui protège réellement, ce sont les dépendances FastAPI
 * `get_current_personnel` et `get_current_personnel_administrateur`, qui
 * refusent la donnée. Un frontend est du code exécuté chez l'utilisateur : il
 * ne garantit rien.
 *
 * Elle n'autorise pas davantage qu'elle ne protège : `est_administrateur` n'est
 * lisible nulle part côté client, et c'est le serveur qui répond 403.
 */

import { Navigate } from 'react-router';

import { useEstPersonnelConnecte } from './useEstConnecte';

interface Proprietes {
  children: React.ReactNode;
}

export default function RoutePersonnel({ children }: Proprietes) {
  if (!useEstPersonnelConnecte()) {
    // `replace` : la page refusée ne doit pas rester dans l'historique, sans
    // quoi le retour arrière y ramènerait aussitôt.
    return <Navigate to="/personnel/connexion" replace />;
  }
  return <>{children}</>;
}
