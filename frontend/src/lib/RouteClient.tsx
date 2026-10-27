/**
 * Garde de route : écarte le personnel connecté de l'espace client.
 *
 * Miroir de `RoutePersonnel.tsx`, dans l'autre sens. `MainLayout` (`/`,
 * `/produits`, `/panier`, `/connexion`...) est pensé pour un client ou un
 * visiteur ; un salarié connecté n'y a plus sa place depuis que
 * `LayoutPersonnel` existe (chantier sidebar) — y rester affichait encore le
 * header client (Produits, Panier...) à un salarié, sans rapport avec son
 * espace de travail.
 *
 * **Cette garde n'est pas une protection.** Comme `RoutePersonnel`, elle évite
 * d'afficher une navigation qui ne concerne pas l'utilisateur connecté ; rien
 * ici n'empêche une requête API de passer, et rien n'a besoin de l'empêcher :
 * `get_current_client` refuserait de toute façon en 401 une requête tentée
 * avec un jeton personnel.
 *
 * **Attend la vérification initiale de session avant de trancher** (T0.10),
 * même raison que `RoutePersonnel` : `GET /auth/moi` répond de façon
 * asynchrone, le cookie étant `httpOnly`. Sans `useChargementSession`, un
 * salarié qui recharge une page de `MainLayout` serait fugitivement montré
 * avant d'être redirigé — pire, un client qui recharge verrait son contenu
 * disparaître un instant si la garde tranchait sur un état pas encore connu.
 */

import { Navigate, Outlet } from 'react-router';

import { useChargementSession, useSession } from './useEstConnecte';

export default function RouteClient() {
  const chargement = useChargementSession();
  const session = useSession();

  if (chargement) {
    // Rien plutôt qu'une redirection prématurée : la vérification est en
    // cours, trancher maintenant risquerait d'écarter un client ou un
    // visiteur à tort.
    return null;
  }
  if (session === 'personnel') {
    // `replace` : la page publique visitée par erreur ne doit pas rester dans
    // l'historique, sans quoi le retour arrière y ramènerait aussitôt.
    return <Navigate to="/personnel" replace />;
  }
  return <Outlet />;
}
