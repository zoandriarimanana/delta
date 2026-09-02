/** Hooks du module d'authentification : état, effets, et rien de visuel. */

import { useCallback, useState } from 'react';

import { effacerJeton, enregistrerSession } from '@/lib/tokenStorage';

import { connecterPersonnel } from './auth.api';
import { messageDeRefus } from './auth.service';
import type { Identifiants } from './auth.types';

export interface ConnexionPersonnel {
  connecter: (identifiants: Identifiants) => Promise<boolean>;
  envoi: boolean;
  erreur: string | null;
}

/**
 * Ouvre une session **personnel**.
 *
 * Le type est déduit de l'endpoint appelé, jamais lu dans le jeton : décoder un
 * JWT côté client pour se fier à son contenu reviendrait à faire confiance à
 * une valeur que le porteur peut réécrire. L'endpoint, lui, est un fait local.
 *
 * Ouvrir une session **remplace** celle qui existait, quelle que soit sa
 * population — conséquence assumée du jeton unique typé
 * (cf. `lib/tokenStorage.ts`).
 */
export function useConnexionPersonnel(): ConnexionPersonnel {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const connecter = useCallback(
    async (identifiants: Identifiants): Promise<boolean> => {
      setEnvoi(true);
      setErreur(null);
      try {
        const { access_token } = await connecterPersonnel(identifiants);
        enregistrerSession(access_token, 'personnel');
        return true;
      } catch (erreurAppel) {
        // La session éventuellement ouverte est effacée : rester connecté comme
        // client après avoir tenté d'ouvrir une session personnel laisserait
        // l'utilisateur sur un état qu'il n'a pas demandé.
        effacerJeton();
        setErreur(messageDeRefus(erreurAppel));
        return false;
      } finally {
        setEnvoi(false);
      }
    },
    []
  );

  return { connecter, envoi, erreur };
}
