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
  id_salle: number | null;
  id_logement: number | null;
}

/**
 * Charge utile envoyée à la création.
 *
 * Ni `statut` ni `id_client` : le premier est un cycle de vie posé par le
 * serveur, le second est déduit du jeton. Les envoyer n'aurait aucun effet, et
 * le type ne les porte pas pour que personne n'essaie.
 */
interface ReservationEnvoyeeBase {
  date_debut: string;
  date_fin: string;
  nombre_personnes: number;
}

/**
 * Réservation d'une session de formation.
 *
 * `avec_hebergement` n'existe que pour ce type : le serveur refuse en 422 sur
 * les autres, et le type l'exprime plutôt que de compter sur ce refus.
 */
export interface ReservationFormationEnvoyee extends ReservationEnvoyeeBase {
  type_reservation: 'Formation';
  id_session: number;
  avec_hebergement: boolean;
}

/** Réservation d'une salle sur un créneau. */
export interface ReservationSalleEnvoyee extends ReservationEnvoyeeBase {
  type_reservation: 'Salle';
  id_salle: number;
}

/** Réservation d'un logement sur un créneau. */
export interface ReservationLogementEnvoyee extends ReservationEnvoyeeBase {
  type_reservation: 'Logement';
  id_logement: number;
}

/**
 * Charge utile envoyée à la création.
 *
 * **Union discriminée par `type_reservation`.** Chaque type ne porte que sa
 * propre cible : le compilateur refuse `type_reservation: 'Salle'` avec un
 * `id_logement`, sans attendre le 422 du serveur.
 */
export type ReservationEnvoyee =
  ReservationFormationEnvoyee | ReservationSalleEnvoyee | ReservationLogementEnvoyee;
