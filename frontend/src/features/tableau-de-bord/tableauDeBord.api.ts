/** Appels HTTP du tableau de bord — et rien d'autre. */

import { axiosClient } from '@/lib/axiosClient';

import type { Periode, TableauDeBord } from './tableauDeBord.types';

/** Chiffres clés et ventes par produit. Réservé aux administrateurs. */
export async function recupererTableauDeBord(periode: Periode): Promise<TableauDeBord> {
  const reponse = await axiosClient.get<TableauDeBord>('/tableau-de-bord', {
    params: { periode },
  });
  return reponse.data;
}
