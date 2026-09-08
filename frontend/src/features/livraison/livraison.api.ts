/**
 * Appels HTTP du module livraison — et rien d'autre.
 *
 * Les deux premiers endpoints répondent avec le **même** schema restreint
 * (`LivraisonPublique`). Ils diffèrent par leur clé d'accès, pas par ce qu'ils
 * divulguent : être connecté ne donne pas droit à connaître son livreur.
 *
 * Les deux suivants (Sprint 10.6) sont réservés au personnel et répondent en
 * `LivraisonAdministration` — schema distinct, jamais retourné sur un chemin
 * public.
 */

import { axiosClient } from '@/lib/axiosClient';

import type {
  LivraisonAdministration,
  StatutLivraison,
  SuiviLivraison,
} from './livraison.types';

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

/**
 * Livraisons vues par le personnel, filtrables par statut — réservé aux
 * écrans d'administration (Sprint 10.6). Ouvert à tout salarié authentifié
 * côté serveur (`GET /livraisons`), pas seulement aux administrateurs.
 */
export async function recupererLivraisonsAdministration(
  statut?: StatutLivraison
): Promise<LivraisonAdministration[]> {
  const reponse = await axiosClient.get<LivraisonAdministration[]>('/livraisons', {
    params: statut === undefined ? undefined : { statut },
  });
  return reponse.data;
}

/**
 * Relance une livraison `Echouee` — transition dédiée `Echouee → En_attente`,
 * réservée aux administrateurs. Voir `LivraisonService.relancer` (10.4).
 */
export async function relancerLivraison(
  idLivraison: number
): Promise<LivraisonAdministration> {
  const reponse = await axiosClient.post<LivraisonAdministration>(
    `/livraisons/${idLivraison}/relance`
  );
  return reponse.data;
}
