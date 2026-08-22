/**
 * Types du module réservation, relevés du schéma OpenAPI.
 *
 * Module distinct de `formation/` : `RESERVATION` est une entité à part entière
 * (cf. la table « modules ↔ tables » de `docs/architecture.md`). Le catalogue ne
 * doit pas appeler l'API de réservation, ni l'inverse.
 */

export type TypeReservation = 'Formation' | 'Salle' | 'Logement' | 'Table';

export type StatutReservation = 'En_attente' | 'Confirmee' | 'Honoree' | 'Annulee';

export interface Reservation {
  id_reservation: number;
  type_reservation: TypeReservation;
  date_debut: string;
  date_fin: string;
  nombre_personnes: number;
  statut: StatutReservation;
  avec_hebergement: boolean;
  id_client: number;
  id_session: number | null;
}

/**
 * Charge utile envoyée à la création.
 *
 * Ni `statut` ni `id_client` : le premier est un cycle de vie posé par le
 * serveur, le second est déduit du jeton. Les envoyer n'aurait aucun effet, et
 * le type ne les porte pas pour que personne n'essaie.
 */
export interface ReservationEnvoyee {
  type_reservation: TypeReservation;
  date_debut: string;
  date_fin: string;
  nombre_personnes: number;
  id_session: number;
  avec_hebergement: boolean;
}
