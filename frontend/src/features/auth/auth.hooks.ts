/** Hooks du module d'authentification : état, effets, et rien de visuel. */

import { useCallback, useState } from 'react';

import { enregistrerSession, type TypeSujet } from '@/lib/tokenStorage';

import { connecterClient, connecterPersonnel } from './auth.api';
import { messageDeRefus } from './auth.service';
import type { Identifiants, Jeton } from './auth.types';

export interface Connexion {
  connecter: (identifiants: Identifiants) => Promise<boolean>;
  envoi: boolean;
  erreur: string | null;
}

/**
 * Ouvre une session, quelle que soit la population.
 *
 * Les deux connexions sont **la même**, à l'endpoint et au type près. Elles
 * vivent donc dans une seule implémentation, que `useConnexionClient` et
 * `useConnexionPersonnel` habillent — même raisonnement que
 * `PersonnelService.obtenir_avec_fonction` côté serveur, où deux copies de la
 * règle auraient divergé au jour où l'une aurait été corrigée sans l'autre.
 *
 * Ce n'est pas une précaution théorique : la règle d'échec ci-dessous a
 * justement dû être corrigée après coup (#63), et une seconde copie serait
 * restée fausse.
 *
 * **Le type vient de l'endpoint appelé, jamais du jeton.** Décoder un JWT côté
 * client pour se fier à son contenu reviendrait à faire confiance à une valeur
 * que son porteur peut réécrire ; l'endpoint, lui, est un fait local.
 *
 * Une connexion **réussie** remplace la session qui existait, quelle que soit sa
 * population — conséquence assumée du jeton unique typé
 * (cf. `lib/tokenStorage.ts`).
 *
 * Un **échec ne touche à rien.** La session en cours n'est ni effacée, ni
 * remplacée : elle appartient à quelqu'un qui est valablement connecté, et une
 * tentative ratée sur un autre compte n'est pas une raison de la lui retirer.
 * Effacer par anticipation, avant de connaître le résultat, ferait payer une
 * faute de frappe par une déconnexion — exactement ce que l'exception des
 * chemins publics évite déjà côté intercepteur HTTP.
 */
function useConnexion(
  appeler: (identifiants: Identifiants) => Promise<Jeton>,
  type: TypeSujet
): Connexion {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const connecter = useCallback(
    async (identifiants: Identifiants): Promise<boolean> => {
      setEnvoi(true);
      setErreur(null);
      try {
        const { access_token } = await appeler(identifiants);
        enregistrerSession(access_token, type);
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
    [appeler, type]
  );

  return { connecter, envoi, erreur };
}

/** Ouvre une session **client**. */
export function useConnexionClient(): Connexion {
  return useConnexion(connecterClient, 'client');
}

/** Ouvre une session **personnel**. */
export function useConnexionPersonnel(): Connexion {
  return useConnexion(connecterPersonnel, 'personnel');
}
