/** Tests des règles d'affichage du catalogue — fonctions pures. */

import { describe, expect, it } from 'vitest';

import {
  explicationSession,
  libelleEtatSession,
  nombreSessionsReservables,
  varianteEtatSession,
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

describe('libelleEtatSession', () => {
  it('distingue une session ouverte d’une session complète', () => {
    expect(libelleEtatSession(session())).toBe('Inscriptions ouvertes');
    expect(libelleEtatSession(session({ places_restantes: 0 }))).toBe('Complète');
  });

  it.each([
    ['Planifiee', 'Bientôt ouverte'],
    ['Terminee', 'Terminée'],
    ['Annulee', 'Annulée'],
  ] as const)('traduit %s', (statut, libelle) => {
    expect(libelleEtatSession(session({ statut }))).toBe(libelle);
  });
});

describe('varianteEtatSession', () => {
  it('suit ce que le visiteur peut faire', () => {
    expect(varianteEtatSession(session())).toBe('positif');
    expect(varianteEtatSession(session({ statut: 'Planifiee' }))).toBe('attente');
    expect(varianteEtatSession(session({ places_restantes: 0 }))).toBe('negatif');
    expect(varianteEtatSession(session({ statut: 'Annulee' }))).toBe('neutre');
  });
});

describe('explicationSession', () => {
  it('explique chaque état en détail', () => {
    expect(explicationSession(session())).toContain('Mes réservations');
    expect(explicationSession(session({ places_restantes: 0 }))).toContain(
      'Toutes les places'
    );
    expect(explicationSession(session({ statut: 'Planifiee' }))).toContain(
      'pas encore ouvertes'
    );
    expect(explicationSession(session({ statut: 'Terminee' }))).toContain('avis');
    expect(explicationSession(session({ statut: 'Annulee' }))).toContain('annulée');
  });
});

describe('nombreSessionsReservables', () => {
  it('ne compte que les sessions ouvertes et non complètes', () => {
    expect(
      nombreSessionsReservables([
        session(),
        session({ places_restantes: 0 }),
        session({ statut: 'Planifiee' }),
        session({ id_session: 2 }),
      ])
    ).toBe(2);
  });
});
