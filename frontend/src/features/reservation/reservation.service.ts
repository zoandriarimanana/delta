/**
 * Règles d'affichage des réservations — fonctions pures, sans appel ni rendu.
 */

import type { StatutReservation } from './reservation.types';

const LIBELLES: Record<StatutReservation, string> = {
  En_attente: 'En attente de confirmation',
  Confirmee: 'Confirmée',
  Honoree: 'Formation suivie',
  // `Annulee` est la seule fin qui rend la place à la session. Le dire au
  // client évite qu'il croie sa place encore retenue.
  Annulee: 'Annulée — votre place a été libérée',
};

/**
 * Traduit un statut en libellé lisible.
 *
 * Un statut inconnu — API en avance sur le frontend — retombe sur un libellé
 * neutre plutôt que sur un identifiant technique brut.
 */
export function libelleStatut(statut: StatutReservation): string {
  return LIBELLES[statut] ?? 'Statut indisponible';
}
