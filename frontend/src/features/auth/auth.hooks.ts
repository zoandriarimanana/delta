/** Hooks du module d'authentification : état, effets, et rien de visuel. */

import { useCallback, useEffect, useState } from 'react';

import { definirSession, effacerSession } from '@/lib/session.store';

import {
  connecterClient,
  connecterPersonnel,
  deconnecter,
  inscrireEntreprise,
  inscrireParticulier,
  lireSessionCourante,
} from './auth.api';
import { messageDeRefus, messageDInscription } from './auth.service';
import type {
  ClientInscrit,
  Identifiants,
  InscriptionEntreprise,
  InscriptionParticulier,
  SessionActive,
  TypeSujet,
} from './auth.types';

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
  appeler: (identifiants: Identifiants) => Promise<SessionActive>,
  type: TypeSujet
): Connexion {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const connecter = useCallback(
    async (identifiants: Identifiants): Promise<boolean> => {
      setEnvoi(true);
      setErreur(null);
      try {
        await appeler(identifiants);
        // Le type est connu localement (c'est l'endpoint qu'on vient d'appeler),
        // pas besoin de rappeler `/auth/moi` : le jeton lui-même est déjà posé
        // en cookie par le serveur, cet appel n'a fait que le confirmer.
        definirSession(type);
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

export interface Inscription<T> {
  inscrire: (donnees: T) => Promise<boolean>;
  envoi: boolean;
  erreur: string | null;
}

/**
 * Crée un compte, sans ouvrir de session.
 *
 * **Aucun jeton n'est écrit, ni avant, ni après.** L'API ne renvoie pas de
 * jeton, et le frontend n'enchaîne pas sur la connexion : cela créerait un
 * second point d'émission, implicite, déclenché par un écran plutôt que par une
 * action de l'utilisateur — précisément ce que la séparation des endpoints
 * cherche à éviter côté serveur. Le frontend ne rouvre pas par commodité ce que
 * l'API a fermé par conception.
 *
 * Une **session en cours n'est pas davantage touchée**, ni en cas de succès ni
 * en cas d'échec : s'inscrire n'est pas se connecter, et rien ne justifie de
 * déconnecter quelqu'un parce qu'il crée un second compte. Même règle que celle
 * corrigée sur la connexion en #63.
 *
 * Les deux variantes — particulier et entreprise — ne diffèrent que par
 * l'endpoint et la charge utile : une seule implémentation, deux habillages,
 * pour que la règle ci-dessus n'existe qu'à un endroit.
 */
function useInscription<T>(
  appeler: (donnees: T) => Promise<ClientInscrit>
): Inscription<T> {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const inscrire = useCallback(
    async (donnees: T): Promise<boolean> => {
      setEnvoi(true);
      setErreur(null);
      try {
        await appeler(donnees);
        return true;
      } catch (erreurAppel) {
        setErreur(messageDInscription(erreurAppel));
        return false;
      } finally {
        setEnvoi(false);
      }
    },
    [appeler]
  );

  return { inscrire, envoi, erreur };
}

/** Inscrit un client **particulier**. */
export function useInscriptionParticulier(): Inscription<InscriptionParticulier> {
  return useInscription(inscrireParticulier);
}

/** Inscrit un client **entreprise**. */
export function useInscriptionEntreprise(): Inscription<InscriptionEntreprise> {
  return useInscription(inscrireEntreprise);
}

/**
 * Vérifie, une fois au chargement de l'application, si une session est déjà
 * ouverte — nécessaire depuis T0.10 : le cookie qui la porte est `httpOnly`,
 * aucun script ne peut plus le lire directement pour le savoir.
 *
 * Monté une seule fois dans `App.tsx`, hors de `<Routes>`, comme
 * `SessionExpiree` — même raisonnement : un effet transverse à toute
 * l'application, pas un composant réservé à une route.
 */
export function useInitialiserSession(): void {
  useEffect(() => {
    let actif = true;
    lireSessionCourante()
      .then(({ type }) => {
        if (actif) {
          definirSession(type);
        }
      })
      .catch(() => {
        // 401 : aucune session — cas normal d'un visiteur non connecté, pas une
        // erreur. `/auth/moi` est un chemin public de l'intercepteur, ce refus
        // ne déclenche donc pas l'événement de session expirée.
        if (actif) {
          effacerSession();
        }
      });
    return () => {
      actif = false;
    };
  }, []);
}

/**
 * Ferme la session, serveur puis magasin local.
 *
 * L'ordre compte : effacer le magasin avant que le serveur ait confirmé
 * laisserait l'interface se croire déconnectée alors que le cookie
 * `delta_session` serait, en cas d'échec réseau, toujours valide côté
 * serveur.
 */
export function useDeconnexion(): () => Promise<void> {
  return useCallback(async () => {
    await deconnecter();
    effacerSession();
  }, []);
}
