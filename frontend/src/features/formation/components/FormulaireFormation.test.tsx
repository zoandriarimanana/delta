/**
 * Tests du formulaire formation.
 *
 * Le point central : le sélecteur de domaine **n'offre que les domaines
 * actifs**. Rattacher une formation à un domaine archivé créerait une
 * incohérence que rien ne rattraperait à l'affichage — même règle que
 * `FormulaireProduit` pour les catégories.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FormulaireFormation from './FormulaireFormation';

const DOMAINES = [
  { id_domaine: 1, libelle: 'Pâtisserie', description: null, supprime_le: null },
  {
    id_domaine: 2,
    libelle: 'Archivé',
    description: null,
    supprime_le: '2026-09-03T08:00:00Z',
  },
];

function afficher(surcharge: Partial<Parameters<typeof FormulaireFormation>[0]> = {}) {
  const surEnvoi = vi.fn();
  render(
    <FormulaireFormation
      domaines={DOMAINES}
      envoi={false}
      erreur={null}
      surEnvoi={surEnvoi}
      surAnnulation={vi.fn()}
      {...surcharge}
    />
  );
  return surEnvoi;
}

afterEach(cleanup);

describe('création', () => {
  it('n’offre que les domaines actifs', () => {
    afficher();

    expect(screen.getByRole('option', { name: 'Pâtisserie' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'Archivé' })).toBeNull();
  });

  it('envoie la charge utile, niveau vide normalisé en null', async () => {
    const surEnvoi = afficher();
    await userEvent.type(screen.getByLabelText(/^titre$/i), 'CAP Pâtissier');

    await userEvent.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => expect(surEnvoi).toHaveBeenCalled());
    expect(surEnvoi.mock.calls[0]?.[0]).toMatchObject({
      titre: 'CAP Pâtissier',
      niveau: null,
      id_domaine: 1,
    });
  });

  it('désactive l’envoi si aucun domaine actif n’existe', () => {
    afficher({
      domaines: [
        {
          id_domaine: 2,
          libelle: 'Archivé',
          description: null,
          supprime_le: '2026-09-03T08:00:00Z',
        },
      ],
    });

    expect(screen.getByRole('button', { name: /créer/i })).toHaveProperty(
      'disabled',
      true
    );
  });
});

describe('modification', () => {
  const FORMATION = {
    id_formation: 7,
    titre: 'CAP Pâtissier',
    niveau: 'Débutant',
    duree_heures: 140,
    prix: '850000.00',
    capacite_max: 12,
    propose_hebergement: true,
    id_domaine: 1,
    note_moyenne: null,
    nombre_avis: 0,
  };

  it('préremplit les champs de la formation', () => {
    afficher({ formation: FORMATION });

    expect(screen.getByLabelText(/^titre$/i)).toHaveProperty('value', 'CAP Pâtissier');
    expect(screen.getByLabelText(/niveau/i)).toHaveProperty('value', 'Débutant');
    expect(screen.getByLabelText(/propose un hébergement/i)).toHaveProperty(
      'checked',
      true
    );
  });

  it('libelle le bouton différemment de la création', () => {
    afficher({ formation: FORMATION });

    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^créer$/i })).toBeNull();
  });
});

describe('refus', () => {
  it('affiche le message du serveur tel quel', () => {
    afficher({ erreur: 'Une formation porte déjà ce titre.' });

    expect(screen.getByRole('alert').textContent).toBe(
      'Une formation porte déjà ce titre.'
    );
  });
});
