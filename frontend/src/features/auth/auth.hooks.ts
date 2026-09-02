/** Hooks du module d'authentification : état, effets, et rien de visuel. */

import { useCallback, useState } from 'react';

import { enregistrerSession } from '@/lib/tokenStorage';

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
 * Une connexion **réussie** remplace la session qui existait, quelle que soit
 * sa population — conséquence assumée du jeton unique typé
 * (cf. `lib/tokenStorage.ts`).
 *
 * Un **échec ne touche à rien.** La session en cours n'est ni effacée, ni
 * remplacée : elle appartient à quelqu'un qui est valablement connecté, et une
 * tentative ratée sur un autre compte n'est pas une raison de la lui retirer.
 * Effacer par anticipation, avant de connaître le résultat, ferait payer une
 * faute de frappe par une déconnexion — exactement ce que l'exception des
 * chemins publics évite déjà côté intercepteur HTTP.
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
        // Rien n'est écrit ni effacé : la session éventuellement en cours reste
        // intacte. Le seul effet d'un refus est le message affiché.
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
