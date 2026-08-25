/**
 * Tests de **typage** de la charge utile de réservation.
 *
 * Chaque `@ts-expect-error` est une assertion à part entière : si le typage se
 * relâchait, la directive deviendrait inutile et `tsc` échouerait sur elle.
 * C'est ce qui empêche l'union discriminée de redevenir silencieusement un
 * objet plat à cibles optionnelles.
 *
 * La garantie porte sur les **littéraux**, ce qui est le cas d'usage réel : la
 * charge utile est construite sur place dans le formulaire.
 */

import { describe, expect, it } from 'vitest';

import type { ReservationEnvoyee } from './reservation.types';

const COMMUN = {
  date_debut: '2026-09-01T08:00:00.000Z',
  date_fin: '2026-09-01T12:00:00.000Z',
  nombre_personnes: 2,
};

describe('ReservationEnvoyee', () => {
  it('exige la cible correspondant au type', () => {
    // Une réservation `Formation` **exige** `id_session` : le `CHECK`
    // d'exclusivité ne peut pas l'imposer, il autorise zéro cible (réservation
    // de table). La règle vit donc dans le schema d'entrée — et ici.
    // @ts-expect-error cible absente
    const sansCible: ReservationEnvoyee = { ...COMMUN, type_reservation: 'Salle' };

    expect(sansCible).toBeDefined();
  });

  it('refuse deux cibles sur la même charge utile', () => {
    // Le `CHECK` d'exclusivité n'en autorise au plus qu'une : en envoyer deux
    // ferait refuser l'insertion par la base.
    const doubleCible: ReservationEnvoyee = {
      ...COMMUN,
      type_reservation: 'Salle',
      id_salle: 4,
      // @ts-expect-error cible étrangère au type
      id_logement: 9,
    };

    expect(doubleCible).toBeDefined();
  });

  it('refuse la cible d’un autre type', () => {
    const mauvaiseCible: ReservationEnvoyee = {
      ...COMMUN,
      type_reservation: 'Logement',
      id_logement: 9,
      // @ts-expect-error `id_session` n'appartient qu'au type Formation
      id_session: 12,
    };

    expect(mauvaiseCible).toBeDefined();
  });

  it('réserve avec_hebergement à la formation', () => {
    // Le serveur refuse l'option sur tout autre type en 422 ; le type l'exprime
    // plutôt que de compter sur ce refus.
    const hebergementHorsFormation: ReservationEnvoyee = {
      ...COMMUN,
      type_reservation: 'Salle',
      id_salle: 4,
      // @ts-expect-error option propre à la formation
      avec_hebergement: true,
    };

    expect(hebergementHorsFormation).toBeDefined();
  });

  it('accepte les trois charges utiles légitimes', () => {
    // Contrôle positif : sans lui, un typage qui refuserait *tout* passerait
    // les quatre assertions ci-dessus.
    const formation: ReservationEnvoyee = {
      ...COMMUN,
      type_reservation: 'Formation',
      id_session: 12,
      avec_hebergement: false,
    };
    const salle: ReservationEnvoyee = {
      ...COMMUN,
      type_reservation: 'Salle',
      id_salle: 4,
    };
    const logement: ReservationEnvoyee = {
      ...COMMUN,
      type_reservation: 'Logement',
      id_logement: 9,
    };

    expect([formation, salle, logement]).toHaveLength(3);
  });
});
