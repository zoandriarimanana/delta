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
 *
 * **Attend la vérification initiale de session avant de trancher** (T0.10) :
 * `GET /auth/moi` répond de façon asynchrone au chargement de l'application,
 * le cookie de session étant `httpOnly`. Sans `useChargementSession`, un
 * salarié réellement connecté qui recharge une page réservée verrait cette
 * garde le rediriger vers la connexion avant que la vérification n'ait eu le
 * temps de répondre.
 */

import { Navigate } from 'react-router';

import { useChargementSession, useEstPersonnelConnecte } from './useEstConnecte';

interface Proprietes {
  children: React.ReactNode;
}

export default function RoutePersonnel({ children }: Proprietes) {
  const chargement = useChargementSession();
  const connecte = useEstPersonnelConnecte();

  if (chargement) {
    // Rien plutôt qu'une redirection prématurée : la vérification est en
    // cours, trancher maintenant risquerait de rediriger un salarié connecté.
    return null;
  }
  if (!connecte) {
    // `replace` : la page refusée ne doit pas rester dans l'historique, sans
    // quoi le retour arrière y ramènerait aussitôt.
    return <Navigate to="/personnel/connexion" replace />;
  }
  return <>{children}</>;
}
