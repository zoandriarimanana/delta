/** Appels HTTP du module d'authentification — et rien d'autre. */

import { axiosClient } from '@/lib/axiosClient';

import type {
  ClientInscrit,
  Identifiants,
  InscriptionEntreprise,
  InscriptionParticulier,
  SessionActive,
} from './auth.types';

/**
 * Connecte un **client**.
 *
 * Endpoint distinct de `/auth/personnel/connexion` : c'est lui qui détermine la
 * population du jeton émis, et donc celle de la session ouverte. Depuis
 * T0.10, le jeton n'est plus dans le corps de la réponse — le serveur le pose
 * en cookie `httpOnly` ; le corps ne confirme que la population.
 */
export async function connecterClient(
  identifiants: Identifiants
): Promise<SessionActive> {
  const reponse = await axiosClient.post<SessionActive>(
    '/auth/connexion',
    identifiants
  );
  return reponse.data;
}

/**
 * Connecte un membre du **personnel**.
 *
 * Endpoint distinct de `/auth/connexion` : c'est lui qui détermine la
 * population du jeton émis, et donc celle de la session ouverte.
 */
export async function connecterPersonnel(
  identifiants: Identifiants
): Promise<SessionActive> {
  const reponse = await axiosClient.post<SessionActive>(
    '/auth/personnel/connexion',
    identifiants
  );
  return reponse.data;
}

/**
 * Inscrit un client **particulier**.
 *
 * Ne renvoie **aucun jeton** : l'API répond le client créé, et la connexion est
 * une étape distincte. Le frontend ne doit pas la déclencher automatiquement —
 * cela créerait un second point d'émission de jeton, implicite, alors que le
 * serveur n'en expose qu'un (cf. `docs/architecture.md`).
 */
export async function inscrireParticulier(
  donnees: InscriptionParticulier
): Promise<ClientInscrit> {
  const reponse = await axiosClient.post<ClientInscrit>('/auth/inscription', donnees);
  return reponse.data;
}

/** Inscrit un client **entreprise**. Endpoint distinct du particulier. */
export async function inscrireEntreprise(
  donnees: InscriptionEntreprise
): Promise<ClientInscrit> {
  const reponse = await axiosClient.post<ClientInscrit>(
    '/auth/inscription-entreprise',
    donnees
  );
  return reponse.data;
}

/**
 * Interroge la session en cours, portée par le cookie `httpOnly` (invisible
 * en JS). Utilisée au chargement de l'application — voir
 * `useInitialiserSession` — pour savoir si une session existe déjà,
 * puisqu'aucun script ne peut plus le lire directement.
 *
 * Rejette en 401 si aucune session valide n'est portée par la requête :
 * laissé tel quel, l'appelant traduit ce refus en « pas connecté », pas en
 * erreur applicative.
 */
export async function lireSessionCourante(): Promise<SessionActive> {
  const reponse = await axiosClient.get<SessionActive>('/auth/moi');
  return reponse.data;
}

/**
 * Ferme la session côté serveur.
 *
 * Nécessaire : le cookie `delta_session` est `httpOnly`, aucun script ne peut
 * l'effacer depuis le navigateur. Le frontend efface son propre magasin
 * réactif (`effacerSession()`) une fois cet appel résolu — voir
 * `MainLayout.seDeconnecter`.
 */
export async function deconnecter(): Promise<void> {
  await axiosClient.post('/auth/deconnexion');
}
