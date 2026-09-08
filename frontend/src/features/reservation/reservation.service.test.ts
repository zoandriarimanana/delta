/** Tests des règles d'affichage des réservations. */

import { describe, expect, it } from 'vitest';

import { libelleCible, libelleStatut } from './reservation.service';
import type { Reservation, StatutReservation } from './reservation.types';

function reservation(partiel: Partial<Reservation>): Reservation {
  return {
    id_reservation: 1,
    type_reservation: 'Formation',
    date_debut: '2026-09-01T00:00:00Z',
    date_fin: '2026-09-05T00:00:00Z',
    nombre_personnes: 1,
    statut: 'En_attente',
    avec_hebergement: false,
    id_client: 3,
    id_session: null,
    id_salle: null,
    id_logement: null,
    ...partiel,
  };
}

describe('libelleStatut', () => {
  it('reste neutre sur Honoree, quel que soit le type', () => {
    // Depuis le sprint 5, une réservation honorée peut être une salle occupée
    // aussi bien qu'une formation suivie.
    expect(libelleStatut('Honoree', 'Salle')).toBe('Honorée');
    expect(libelleStatut('Honoree', 'Formation')).toBe('Honorée');
  });

  it('ne parle de place libérée que pour une formation', () => {
    // Seule une session porte un compteur `places_restantes` ; un créneau de
    // salle n'a rien à restituer.
    expect(libelleStatut('Annulee', 'Formation')).toMatch(/libérée/);
    expect(libelleStatut('Annulee', 'Salle')).not.toMatch(/libérée/);
    expect(libelleStatut('Annulee', 'Logement')).not.toMatch(/libérée/);
  });

  it('retombe sur un libellé neutre pour un statut inconnu', () => {
    expect(libelleStatut('Reportee' as StatutReservation)).toBe('Statut indisponible');
  });
});

describe('libelleCible', () => {
  it('nomme la cible correspondant au type', () => {
    expect(
      libelleCible(reservation({ type_reservation: 'Formation', id_session: 12 }))
    ).toMatch(/formation n° 12/i);
    expect(
      libelleCible(reservation({ type_reservation: 'Salle', id_salle: 4 }))
    ).toMatch(/salle n° 4/i);
    expect(
      libelleCible(reservation({ type_reservation: 'Logement', id_logement: 9 }))
    ).toMatch(/hébergement n° 9/i);
  });

  it('ne lit jamais la cible d’un autre type', () => {
    // Les colonnes sont exclusives par `CHECK` ; si l'API en renvoyait deux,
    // c'est le type qui tranche, pas l'ordre de lecture.
    const melange = reservation({
      type_reservation: 'Salle',
      id_salle: 4,
      id_session: 12,
    });

    expect(libelleCible(melange)).toMatch(/salle n° 4/i);
    expect(libelleCible(melange)).not.toMatch(/12/);
  });

  it('nomme une réservation de table sans cible', () => {
    // `Table` ne porte aucune cible : c'est prévu, pas une donnée manquante.
    expect(libelleCible(reservation({ type_reservation: 'Table' }))).toBe('Table');
  });
});
