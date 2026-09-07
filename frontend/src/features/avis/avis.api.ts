/**
 * Appels HTTP du module avis — et rien d'autre.
 *
 * Aucune mise en forme, aucune règle métier : l'instance axios est celle de
 * `lib/axiosClient`, jamais une nouvelle (cf. `docs/architecture.md`).
 */

import { axiosClient } from '@/lib/axiosClient';

import type { Avis, AvisEnvoye } from './avis.types';

const CHEMIN_AVIS = '/avis';

/**
 * Dépose un avis pour le client connecté.
 *
 * **422** si la cible n'existe pas ou n'appartient pas au client. **409** si
 * la cible n'a pas atteint son statut terminal, ou si un avis existe déjà
 * pour cette cible.
 */
export async function creerAvis(donnees: AvisEnvoye): Promise<Avis> {
  const reponse = await axiosClient.post<Avis>(CHEMIN_AVIS, donnees);
  return reponse.data;
}
