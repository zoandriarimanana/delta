/** Appels HTTP du module logement — et rien d'autre. Lectures publiques. */

import { axiosClient } from '@/lib/axiosClient';

import type { Logement, StatutLogement } from './logement.types';

/**
 * Catalogue des logements, filtrable par état et par capacité.
 *
 * Le filtre par statut ne dit **rien** de la disponibilité à une date donnée :
 * il retient les logements dont l'état le permet.
 */
export async function recupererLogements(
  statut?: StatutLogement,
  capaciteMinimale?: number
): Promise<Logement[]> {
  const params: Record<string, string | number> = {};
  if (statut !== undefined) {
    params.statut = statut;
  }
  if (capaciteMinimale !== undefined) {
    params.capacite_minimale = capaciteMinimale;
  }
  const reponse = await axiosClient.get<Logement[]>('/logements', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return reponse.data;
}

export async function recupererLogement(idLogement: number): Promise<Logement> {
  const reponse = await axiosClient.get<Logement>(`/logements/${idLogement}`);
  return reponse.data;
}
