/** Tests des règles d'affichage d'un logement. */

import { describe, expect, it } from 'vitest';

import { estReservable, libelleStatut } from './logement.service';
import type { Logement, StatutLogement } from './logement.types';

function logement(statut: StatutLogement): Logement {
  return {
    id_logement: 1,
    type_chambre: 'Chambre double',
    capacite: 2,
    tarif_nuitee: '80000.00',
    statut,
  };
}

describe('libelleStatut', () => {
  it('traduit les trois états du domaine', () => {
    expect(libelleStatut('Disponible')).toMatch(/disponible/i);
    expect(libelleStatut('En_maintenance')).toMatch(/indisponible/i);
    expect(libelleStatut('Hors_service')).toMatch(/retiré/i);
  });

  it('ne laisse jamais fuir l’identifiant technique', () => {
    expect(libelleStatut('En_maintenance')).not.toContain('En_maintenance');
  });

  it('retombe sur un libellé neutre pour un statut inconnu', () => {
    // API en avance sur le frontend : mieux vaut un libellé neutre qu'un
    // identifiant brut ou une case vide.
    expect(libelleStatut('Occupe' as StatutLogement)).toBe('État indisponible');
  });
});

describe('estReservable', () => {
  it('n’autorise que l’état Disponible', () => {
    expect(estReservable(logement('Disponible'))).toBe(true);
    expect(estReservable(logement('En_maintenance'))).toBe(false);
    expect(estReservable(logement('Hors_service'))).toBe(false);
  });
});
