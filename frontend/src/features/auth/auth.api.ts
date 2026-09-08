/** Appels HTTP du module d'authentification — et rien d'autre. */

import { axiosClient } from '@/lib/axiosClient';

import type {
  ClientInscrit,
  Identifiants,
  InscriptionEntreprise,
  InscriptionParticulier,
  Jeton,
} from './auth.types';

/**
 * Connecte un **client**.
 *
 * Endpoint distinct de `/auth/personnel/connexion` : c'est lui qui détermine la
 * population du jeton émis, et donc celle de la session ouverte.
 */
export async function connecterClient(identifiants: Identifiants): Promise<Jeton> {
  const reponse = await axiosClient.post<Jeton>('/auth/connexion', identifiants);
  return reponse.data;
}

/**
 * Connecte un membre du **personnel**.
 *
 * Endpoint distinct de `/auth/connexion` : c'est lui qui détermine la
 * population du jeton émis, et donc celle de la session ouverte.
 */
export async function connecterPersonnel(identifiants: Identifiants): Promise<Jeton> {
  const reponse = await axiosClient.post<Jeton>(
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
