/** Tests des règles d'affichage du catalogue — fonctions pures. */

import { describe, expect, it } from 'vitest';

import {
  estReservable,
  formaterDuree,
  nomFormateur,
  raisonIndisponible,
} from './formation.service';
import type { SessionFormation, StatutSessionFormation } from './formation.types';

function session(surcharge: Partial<SessionFormation> = {}): SessionFormation {
  return {
    id_session: 1,
    date_debut: '2026-09-01',
    date_fin: '2026-09-05',
    places_restantes: 5,
    statut: 'Ouverte',
    id_formation: 1,
    formateur: null,
    ...surcharge,
  };
}

describe('estReservable', () => {
  it('exige une session ouverte ET des places', () => {
    expect(estReservable(session())).toBe(true);
  });

  it('refuse une session ouverte mais complète', () => {
    expect(estReservable(session({ places_restantes: 0 }))).toBe(false);
  });

  it.each(['Planifiee', 'Terminee', 'Annulee'] as StatutSessionFormation[])(
    'refuse une session %s même avec des places',
    (statut) => {
      expect(estReservable(session({ statut }))).toBe(false);
    }
  );
});

describe('raisonIndisponible', () => {
  it('ne dit rien d’une session réservable', () => {
    expect(raisonIndisponible(session())).toBeNull();
  });

  it('distingue « complète » de « pas encore ouverte »', () => {
    // Les confondre laisserait croire au client qu'il n'y a plus de place,
    // alors que les inscriptions n'ont simplement pas commencé.
    const complete = raisonIndisponible(session({ places_restantes: 0 }));
    const planifiee = raisonIndisponible(session({ statut: 'Planifiee' }));

    expect(complete).toMatch(/complète/i);
    expect(planifiee).toMatch(/pas encore/i);
    expect(complete).not.toBe(planifiee);
  });

  it.each(['Planifiee', 'Terminee', 'Annulee'] as StatutSessionFormation[])(
    '%s ne montre aucun identifiant technique',
    (statut) => {
      const raison = raisonIndisponible(session({ statut })) ?? '';

      expect(raison).not.toContain(statut);
      expect(raison.length).toBeGreaterThan(0);
    }
  );

  it('retombe sur un libellé neutre pour un statut inconnu', () => {
    const raison = raisonIndisponible(
      session({ statut: 'Inattendu' as StatutSessionFormation })
    );

    expect(raison).toBe('Session indisponible.');
  });
});

describe('nomFormateur', () => {
  it('ne compose qu’à partir du prénom et du nom', () => {
    expect(nomFormateur({ nom: 'Rabe', prenom: 'Paul', specialite: null })).toBe(
      'Paul Rabe'
    );
  });
});

describe('formaterDuree', () => {
  it('affiche des heures', () => {
    expect(formaterDuree(140)).toBe('140 h');
  });
});
