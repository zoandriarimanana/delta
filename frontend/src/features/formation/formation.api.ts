/**
 * Appels HTTP du module formation — et rien d'autre.
 *
 * Toutes ces lectures sont **publiques** : un visiteur doit pouvoir parcourir
 * l'offre sans compte. L'intercepteur ajoute le jeton s'il existe, mais aucun
 * de ces appels n'en dépend.
 */

import { axiosClient } from '@/lib/axiosClient';

import type { DomaineFormation, Formation, SessionFormation } from './formation.types';

export async function recupererDomaines(): Promise<DomaineFormation[]> {
  const reponse = await axiosClient.get<DomaineFormation[]>('/domaines-formation');
  return reponse.data;
}

/** Catalogue des formations, filtrable par domaine. */
export async function recupererFormations(idDomaine?: number): Promise<Formation[]> {
  const reponse = await axiosClient.get<Formation[]>('/formations', {
    params: idDomaine === undefined ? undefined : { id_domaine: idDomaine },
  });
  return reponse.data;
}

export async function recupererFormation(idFormation: number): Promise<Formation> {
  const reponse = await axiosClient.get<Formation>(`/formations/${idFormation}`);
  return reponse.data;
}

/** Sessions d'une formation, avec leur formateur quand il est affecté. */
export async function recupererSessions(
  idFormation: number
): Promise<SessionFormation[]> {
  const reponse = await axiosClient.get<SessionFormation[]>('/sessions-formation', {
    params: { id_formation: idFormation },
  });
  return reponse.data;
}
