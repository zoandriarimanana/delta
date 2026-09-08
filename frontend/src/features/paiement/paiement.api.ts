/**
 * Appels HTTP du module paiement — et rien d'autre.
 *
 * L'instance axios est celle de `lib/axiosClient`, jamais une nouvelle : c'est
 * elle qui porte l'URL de base et l'injection du jeton.
 */

import { axiosClient } from '@/lib/axiosClient';

import type { Paiement, PaiementEnvoye } from './paiement.types';

/**
 * Initie un paiement pour une commande déjà créée — action **séparée** du
 * tunnel de commande (cf. `docs/mld.md`, Sprint 9). **409** si la commande
 * est annulée ou déjà payée ; le message est repris tel quel par l'appelant.
 */
export async function initierPaiement(
  idCommande: number,
  donnees: PaiementEnvoye
): Promise<Paiement> {
  const reponse = await axiosClient.post<Paiement>(
    `/commandes/${idCommande}/paiements`,
    donnees
  );
  return reponse.data;
}

/**
 * Déclenche, en attendant les accès API réels aux fournisseurs, la
 * confirmation qu'un vrai fournisseur enverrait de lui-même par webhook.
 *
 * **Dev uniquement** : fermé côté serveur en dehors de
 * `ENVIRONMENT=developpement`, avec le même 404 générique qu'un paiement
 * introuvable (cf. `docs/mld.md`) — la protection réelle vit dans le
 * backend, pas ici.
 */
export async function simulerConfirmation(idPaiement: number): Promise<Paiement> {
  const reponse = await axiosClient.post<Paiement>(
    `/paiements/${idPaiement}/simuler-confirmation`
  );
  return reponse.data;
}
