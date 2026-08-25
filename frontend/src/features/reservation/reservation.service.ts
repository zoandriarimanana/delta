/**
 * Règles d'affichage des réservations — fonctions pures, sans appel ni rendu.
 */

import type {
  Reservation,
  StatutReservation,
  TypeReservation,
} from './reservation.types';

const LIBELLES: Record<StatutReservation, string> = {
  En_attente: 'En attente de confirmation',
  Confirmee: 'Confirmée',
  // Volontairement neutre : depuis le sprint 5, une réservation honorée peut
  // être une formation suivie comme une salle occupée. « Formation suivie »
  // aurait menti sur trois types de réservation sur quatre.
  Honoree: 'Honorée',
  Annulee: 'Annulée',
};

/**
 * Traduit un statut en libellé lisible.
 *
 * Un statut inconnu — API en avance sur le frontend — retombe sur un libellé
 * neutre plutôt que sur un identifiant technique brut.
 *
 * Le `type` est facultatif et ne sert qu'à une précision : seule une
 * réservation de formation rend une place à sa session en s'annulant, et le
 * dire évite au client de croire sa place encore retenue. La même phrase sur
 * une salle n'aurait aucun sens — un créneau n'a pas de compteur.
 */
export function libelleStatut(
  statut: StatutReservation,
  type?: TypeReservation
): string {
  const libelle = LIBELLES[statut] ?? 'Statut indisponible';
  if (statut === 'Annulee' && type === 'Formation') {
    return `${libelle} — votre place a été libérée`;
  }
  return libelle;
}

/**
 * Nomme l'objet d'une réservation en une ligne.
 *
 * Les identifiants de cible sont **exclusifs** : le `CHECK` de `RESERVATION`
 * en autorise au plus un (cf. `docs/mld.md`). On lit donc celui qui correspond
 * au type, sans avoir à arbitrer entre deux valeurs concurrentes.
 *
 * On nomme la cible par son identifiant et non par son libellé : la charge
 * utile d'une réservation ne porte ni le nom de la salle ni le type de la
 * chambre, et aller les chercher ferait une requête par ligne affichée — la
 * dette N+1 déjà relevée sur l'historique des commandes.
 */
export function libelleCible(reservation: Reservation): string {
  switch (reservation.type_reservation) {
    case 'Formation':
      return reservation.id_session === null
        ? 'Formation'
        : `Session de formation n° ${reservation.id_session}`;
    case 'Salle':
      return reservation.id_salle === null
        ? 'Salle'
        : `Salle n° ${reservation.id_salle}`;
    case 'Logement':
      return reservation.id_logement === null
        ? 'Hébergement'
        : `Hébergement n° ${reservation.id_logement}`;
    default:
      // `Table` ne porte aucune cible : c'est prévu par le `CHECK`, pas une
      // donnée manquante (cf. `docs/mld.md`).
      return 'Table';
  }
}
