/**
 * Appels HTTP du module commande — et rien d'autre.
 *
 * L'instance axios est celle de `lib/axiosClient`, jamais une nouvelle : c'est
 * elle qui porte l'URL de base et l'injection du jeton.
 */

import { axiosClient } from '@/lib/axiosClient';

import type {
  Commande,
  CommandeEnvoyee,
  CommandeInviteEnvoyee,
} from './commande.types';

const CHEMIN = '/commandes';

/**
 * Crée une commande au nom du client connecté.
 *
 * Le jeton est ajouté par l'intercepteur. Sans lui, l'API répond 401 — elle ne
 * bascule **pas** en mode invité, et c'est voulu : un jeton expiré donnerait
 * sinon une commande anonyme introuvable dans l'historique.
 */
export async function creerCommande(donnees: CommandeEnvoyee): Promise<Commande> {
  const reponse = await axiosClient.post<Commande>(CHEMIN, donnees);
  return reponse.data;
}

/** Crée une commande sans compte. La réponse porte la référence publique. */
export async function creerCommandeInvite(
  donnees: CommandeInviteEnvoyee
): Promise<Commande> {
  const reponse = await axiosClient.post<Commande>(`${CHEMIN}/invite`, donnees);
  return reponse.data;
}

/** Relit une commande invitée par sa référence. Endpoint public. */
export async function recupererCommandeInvitee(reference: string): Promise<Commande> {
  const reponse = await axiosClient.get<Commande>(`${CHEMIN}/invite/${reference}`);
  return reponse.data;
}

/**
 * Historique du client authentifié.
 *
 * Le filtre vient du jeton, jamais d'un paramètre : c'est ce qui empêche de
 * lire l'historique d'autrui. Les commandes archivées n'y figurent pas, et les
 * commandes invitées non plus — sans `id_client`, elles n'appartiennent à aucun
 * historique par construction.
 */
export async function recupererHistorique(): Promise<Commande[]> {
  const reponse = await axiosClient.get<Commande[]>(CHEMIN);
  return reponse.data;
}
