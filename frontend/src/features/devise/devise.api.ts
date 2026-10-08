/** Appels HTTP du module devise — et rien d'autre. */

import { axiosClient } from '@/lib/axiosClient';

import type { Devise, TauxChange } from './devise.types';

/** Taux des devises étrangères. Public : affiché avant tout compte. */
export async function recupererTaux(): Promise<TauxChange[]> {
  const reponse = await axiosClient.get<TauxChange[]>('/taux-change');
  return reponse.data;
}

/** Règle le taux d'une devise. Réservé aux administrateurs (403 sinon). */
export async function modifierTaux(
  devise: Exclude<Devise, 'MGA'>,
  ariaryParUnite: string
): Promise<TauxChange> {
  const reponse = await axiosClient.put<TauxChange>(`/taux-change/${devise}`, {
    ariary_par_unite: ariaryParUnite,
  });
  return reponse.data;
}
