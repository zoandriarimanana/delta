/** Appels HTTP du module réservation — et rien d'autre. */

import { axiosClient } from '@/lib/axiosClient';

import type { Reservation, ReservationEnvoyee } from './reservation.types';

/**
 * Réserve des places sur une session.
 *
 * Le jeton est ajouté par l'intercepteur ; sans lui l'API répond 401. Elle ne
 * bascule pas en mode invité — réserver exige un compte, contrairement à
 * commander (cf. `docs/mld.md`).
 */
export async function creerReservation(
  donnees: ReservationEnvoyee
): Promise<Reservation> {
  const reponse = await axiosClient.post<Reservation>('/reservations', donnees);
  return reponse.data;
}

/** Réservations du client connecté, les plus récentes d'abord. */
export async function recupererReservations(): Promise<Reservation[]> {
  const reponse = await axiosClient.get<Reservation[]>('/reservations');
  return reponse.data;
}
