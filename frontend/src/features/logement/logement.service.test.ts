/** Tests des règles d'affichage d'un logement. */

import { describe, expect, it } from 'vitest';

import { estReservable, explicationStatut, libelleStatut } from './logement.service';
import type { Logement, StatutLogement } from './logement.types';

function logement(statut: StatutLogement): Logement {
  return {
    id_logement: 1,
    type_chambre: 'Chambre double',
    description: null,
    capacite: 2,
    tarif_nuitee: '80000.00',
    statut,
    note_moyenne: null,
    nombre_avis: 0,
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

describe('explicationStatut', () => {
  it('dit au visiteur ce qu’il peut faire, pour chaque état', () => {
    expect(explicationStatut('Disponible')).toContain('ouvert à la réservation');
    expect(explicationStatut('En_maintenance')).toContain('reviendra dans l’offre');
    expect(explicationStatut('Hors_service')).toContain('retiré de notre offre');
  });

  it('ne parle jamais d’occupation : le statut décrit le bien', () => {
    for (const statut of ['Disponible', 'En_maintenance', 'Hors_service'] as const) {
      expect(explicationStatut(statut)).not.toMatch(/occup/i);
    }
  });

  it('retombe sur un texte neutre pour un statut inconnu', () => {
    expect(explicationStatut('Inconnu' as StatutLogement)).toMatch(/pas disponible/);
  });
});
