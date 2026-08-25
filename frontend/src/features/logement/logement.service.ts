/** Règles d'affichage des logements — fonctions pures. */

import type { Logement, StatutLogement } from './logement.types';

const LIBELLES: Record<StatutLogement, string> = {
  Disponible: 'Disponible à la réservation',
  // Le client n'a pas à connaître le détail : ce qui l'intéresse est de savoir
  // qu'il ne peut pas réserver, et si cela peut changer.
  En_maintenance: 'Temporairement indisponible',
  Hors_service: 'Retiré de l’offre',
};

/**
 * Traduit un statut en libellé lisible.
 *
 * Un statut inconnu — API en avance sur le frontend — retombe sur un libellé
 * neutre plutôt que sur un identifiant technique brut.
 */
export function libelleStatut(statut: StatutLogement): string {
  return LIBELLES[statut] ?? 'État indisponible';
}

/**
 * Indique si un logement peut être réservé.
 *
 * **Ne dit rien de sa disponibilité à une date donnée** : le serveur refuse en
 * 409 si le créneau est déjà pris. Ceci évite un aller-retour inutile sur un
 * bien qui n'est de toute façon pas louable, ce n'est pas la garantie.
 */
export function estReservable(logement: Logement): boolean {
  return logement.statut === 'Disponible';
}
