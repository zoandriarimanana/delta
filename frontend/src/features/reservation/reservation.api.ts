/** Appels HTTP du module réservation — et rien d'autre. */

import { axiosClient } from '@/lib/axiosClient';

import type { Reservation, ReservationEnvoyee } from './reservation.types';

const CHEMIN_ADMINISTRATION = '/reservations/administration';

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

/**
 * Toutes les réservations, les 4 types confondus. Réservé à l'administration.
 *
 * Ne porte aucun paramètre de filtre côté serveur — `GET
 * /reservations/administration` n'en expose pas (Sprint 10.2). Le filtre par
 * type/statut de `AdministrationReservationsPage` s'applique donc côté
 * client, sur la liste complète.
 */
export async function recupererReservationsAdministration(): Promise<Reservation[]> {
  const reponse = await axiosClient.get<Reservation[]>(CHEMIN_ADMINISTRATION);
  return reponse.data;
}

/** Une réservation par son identifiant. Réservé à l'administration. */
export async function recupererReservationAdministration(
  idReservation: number
): Promise<Reservation> {
  const reponse = await axiosClient.get<Reservation>(
    `${CHEMIN_ADMINISTRATION}/${idReservation}`
  );
  return reponse.data;
}

/**
 * Marque une réservation `Honoree` ou `Annulee` — réservé à l'administration.
 *
 * C'est le **seul** point d'accès à `Honoree` : le client, lui, ne peut
 * demander que `Annulee` sur sa propre réservation (cf. `docs/mld.md`,
 * Sprint 10.2 — un client pouvait auparavant se déclarer lui-même « servi »
 * sans prestation réelle).
 */
export async function changerStatutAdministration(
  idReservation: number,
  statut: 'Honoree' | 'Annulee'
): Promise<Reservation> {
  const reponse = await axiosClient.put<Reservation>(
    `${CHEMIN_ADMINISTRATION}/${idReservation}/statut`,
    { statut }
  );
  return reponse.data;
}
