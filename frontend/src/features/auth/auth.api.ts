/** Appels HTTP du module d'authentification — et rien d'autre. */

import { axiosClient } from '@/lib/axiosClient';

import type { Identifiants, Jeton } from './auth.types';

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
