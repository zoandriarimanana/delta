/**
 * Hooks du module avis.
 *
 * L'API renvoie deux erreurs **métier** distinctes, qui portent chacune une
 * information que le client peut utiliser :
 *
 * - **409** « Cette commande n'est pas encore Livree… » / « Cette réservation
 *   n'est pas honorée… » / « Un avis a déjà été déposé sur cette cible. » —
 *   la référence est valide, c'est l'état actuel qui s'y oppose ;
 * - **422** « Aucune ligne de commande ne porte l'identifiant… » — la cible
 *   n'existe pas ou n'appartient pas au client.
 *
 * Les remplacer par un message générique ferait perdre exactement ce qui
 * permet de comprendre le refus — même traitement que `reservation.hooks.ts`
 * (Sprint 5).
 */

import { useCallback, useState } from 'react';

import { creerAvis } from './avis.api';
import type { Avis, AvisEnvoye } from './avis.types';

const MESSAGE_ERREUR_PAR_DEFAUT =
  'L’avis n’a pas pu être enregistré. Réessayez dans un instant.';

export interface DepotAvis {
  deposer: (donnees: AvisEnvoye) => Promise<Avis | null>;
  envoi: boolean;
  erreur: string | null;
  reussite: Avis | null;
  reinitialiser: () => void;
}

/**
 * Extrait le message métier de l'API, ou retombe sur un message générique.
 *
 * Même fonction que `reservation.hooks.ts` : FastAPI place le message dans
 * `detail` pour nos erreurs métier, une liste pour une erreur de validation
 * de schema — la rendre telle quelle afficherait du JSON.
 */
function messageDAvis(erreur: unknown): string {
  const detail = (erreur as { response?: { data?: { detail?: unknown } } } | null)
    ?.response?.data?.detail;
  return typeof detail === 'string' && detail.length > 0
    ? detail
    : MESSAGE_ERREUR_PAR_DEFAUT;
}

/**
 * Dépose un avis et suit l'état de l'envoi.
 *
 * `reussite` porte l'avis créé, pour que l'appelant puisse masquer le
 * formulaire sans refaire d'appel.
 */
export function useDepotAvis(): DepotAvis {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reussite, setReussite] = useState<Avis | null>(null);

  const deposer = useCallback(async (donnees: AvisEnvoye): Promise<Avis | null> => {
    setEnvoi(true);
    setErreur(null);

    try {
      const avis = await creerAvis(donnees);
      setReussite(avis);
      return avis;
    } catch (erreurAppel) {
      setErreur(messageDAvis(erreurAppel));
      return null;
    } finally {
      setEnvoi(false);
    }
  }, []);

  const reinitialiser = useCallback(() => {
    setErreur(null);
    setReussite(null);
  }, []);

  return { deposer, envoi, erreur, reussite, reinitialiser };
}
