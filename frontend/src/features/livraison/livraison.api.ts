/**
 * Appels HTTP du module livraison — et rien d'autre.
 *
 * Les deux endpoints répondent avec le **même** schema restreint
 * (`LivraisonPublique`). Ils diffèrent par leur clé d'accès, pas par ce qu'ils
 * divulguent : être connecté ne donne pas droit à connaître son livreur.
 */

import { axiosClient } from '@/lib/axiosClient';

import type { SuiviLivraison } from './livraison.types';

/**
 * Suivi de la livraison d'une commande du client connecté.
 *
 * 404 si la commande n'existe pas, appartient à quelqu'un d'autre, ou n'a
 * aucune livraison — les trois cas sont volontairement indistinguables côté
 * serveur.
 */
export async function recupererSuivi(idCommande: number): Promise<SuiviLivraison> {
  const reponse = await axiosClient.get<SuiviLivraison>(
    `/commandes/${idCommande}/livraison`
  );
  return reponse.data;
}

/**
 * Suivi d'une commande passée sans compte, par sa référence publique.
 *
 * Aucune authentification : l'UUID est la seule clé. C'est précisément pourquoi
 * la réponse ne porte pas l'identité du livreur.
 */
export async function recupererSuiviInvite(reference: string): Promise<SuiviLivraison> {
  const reponse = await axiosClient.get<SuiviLivraison>(
    `/commandes/invite/${reference}/livraison`
  );
  return reponse.data;
}
