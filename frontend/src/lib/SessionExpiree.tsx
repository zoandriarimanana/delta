/**
 * Pont entre la couche HTTP et le routage.
 *
 * `axiosClient` émet `delta:non-authentifie` quand le serveur rejette le jeton,
 * sans connaître le routeur — la couche HTTP ne doit pas dépendre de la
 * navigation. Ce composant fait la jonction inverse : il écoute l'événement et
 * redirige.
 *
 * Il vit dans `lib/` et non dans `layouts/` : `layouts/` porte la structure de
 * page (nav, en-tête, pied de page), et rien d'autre. Placer l'écouteur ici le
 * rend en outre actif sur toutes les routes, y compris celles qui ne passeraient
 * pas par le layout principal.
 *
 * Ne rend rien : c'est un effet, pas un élément d'interface.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { EVENEMENT_NON_AUTHENTIFIE } from './axiosClient';

export default function SessionExpiree() {
  const naviguer = useNavigate();

  useEffect(() => {
    const rediriger = () => {
      // `replace` : la page dont on a été éjecté ne doit pas rester dans
      // l'historique, sinon le bouton « précédent » y ramène pour rejouer le
      // même 401.
      naviguer('/connexion', { replace: true });
    };

    window.addEventListener(EVENEMENT_NON_AUTHENTIFIE, rediriger);
    // Nettoyage au démontage : sans lui, chaque remontage empilerait un
    // écouteur de plus et un seul 401 déclencherait plusieurs redirections.
    return () => window.removeEventListener(EVENEMENT_NON_AUTHENTIFIE, rediriger);
  }, [naviguer]);

  return null;
}
