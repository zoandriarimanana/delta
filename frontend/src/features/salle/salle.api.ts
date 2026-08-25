/**
 * Appels HTTP du module salle — et rien d'autre.
 *
 * Ces lectures sont **publiques** : un visiteur doit pouvoir consulter les
 * espaces sans compte.
 */

import { axiosClient } from '@/lib/axiosClient';

import type { Salle } from './salle.types';

/** Catalogue des salles, filtrable par capacité minimale. */
export async function recupererSalles(capaciteMinimale?: number): Promise<Salle[]> {
  const reponse = await axiosClient.get<Salle[]>('/salles', {
    params:
      capaciteMinimale === undefined
        ? undefined
        : { capacite_minimale: capaciteMinimale },
  });
  return reponse.data;
}

export async function recupererSalle(idSalle: number): Promise<Salle> {
  const reponse = await axiosClient.get<Salle>(`/salles/${idSalle}`);
  return reponse.data;
}
