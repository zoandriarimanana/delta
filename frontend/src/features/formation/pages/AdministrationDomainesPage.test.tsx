/**
 * Tests de l'écran des domaines de formation.
 *
 * Même patron que `AdministrationCategoriesPage.test.tsx` : la restauration
 * peut échouer en 409, l'index unique sur le libellé étant partiel — le nom a
 * pu être repris pendant l'archivage.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RoutePersonnel from '@/lib/RoutePersonnel';
import { definirSession, effacerSession } from '@/lib/session.store';

import {
  archiverDomaine,
  creerDomaine,
  recupererDomainesAdministration,
  restaurerDomaine,
} from '../formation.api';
import AdministrationDomainesPage from './AdministrationDomainesPage';

vi.mock('../formation.api');

const ACTIF = {
  id_domaine: 1,
  libelle: 'Pâtisserie',
  description: 'Ateliers pâtisserie',
  supprime_le: null,
};
const ARCHIVE = {
  id_domaine: 2,
  libelle: 'Cuisine',
  description: null,
  supprime_le: '2026-09-03T08:12:44Z',
};

function afficherSousGarde() {
  return render(
    <MemoryRouter initialEntries={['/personnel/domaines-formation']}>
      <Routes>
        <Route
          path="/personnel/domaines-formation"
          element={
            <RoutePersonnel>
              <AdministrationDomainesPage />
            </RoutePersonnel>
          }
        />
        <Route path="/personnel/connexion" element={<p>connexion personnel</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function afficher() {
  return render(
    <MemoryRouter>
      <AdministrationDomainesPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  effacerSession();
  vi.mocked(recupererDomainesAdministration).mockResolvedValue([ACTIF, ARCHIVE]);
  vi.mocked(creerDomaine).mockResolvedValue(ACTIF);
  vi.mocked(archiverDomaine).mockResolvedValue(undefined);
  vi.mocked(restaurerDomaine).mockResolvedValue(ACTIF);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerSession();
});

describe('accès', () => {
  it('refuse un jeton client', () => {
    definirSession('client');

    afficherSousGarde();

    expect(screen.getByText('connexion personnel')).toBeDefined();
    expect(recupererDomainesAdministration).not.toHaveBeenCalled();
  });

  it('refuse un visiteur non connecté', () => {
    afficherSousGarde();

    expect(screen.getByText('connexion personnel')).toBeDefined();
  });

  it('ouvre l’écran pour un salarié', () => {
    definirSession('personnel');

    afficherSousGarde();

    expect(
      screen.getByRole('heading', { name: /domaines de formation/i })
    ).toBeDefined();
  });

  it('propose un lien réciproque vers les formations', () => {
    // Ajouté avec la sous-tâche FORMATION (2/3 du chantier) : absent tant que
    // cet écran n'existait pas, pour ne pas pointer vers une route morte.
    definirSession('personnel');

    afficherSousGarde();

    expect(screen.getByRole('link', { name: /retour aux formations/i })).toHaveProperty(
      'href',
      expect.stringContaining('/personnel/formations')
    );
  });
});

describe('liste', () => {
  beforeEach(() => definirSession('personnel'));

  it('masque les archives par défaut et les compte', async () => {
    afficher();

    expect(await screen.findByText('Pâtisserie')).toBeDefined();
    expect(screen.queryByText('Cuisine')).toBeNull();
    expect(screen.getByLabelText(/afficher les archives \(1\)/i)).toBeDefined();
  });

  it('les affiche à la demande', async () => {
    afficher();
    await screen.findByText('Pâtisserie');

    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    expect(screen.getByText('Cuisine')).toBeDefined();
  });

  it('affiche la description quand elle existe', async () => {
    afficher();

    expect(await screen.findByText('Ateliers pâtisserie')).toBeDefined();
  });

  it('dit « archiver », jamais « supprimer »', async () => {
    const { container } = afficher();
    await screen.findByText('Pâtisserie');

    expect(screen.getByRole('button', { name: /archiver/i })).toBeDefined();
    expect(container.textContent?.toLowerCase()).not.toContain('supprimer');
  });
});

describe('écritures', () => {
  beforeEach(() => definirSession('personnel'));

  it('crée un domaine avec libellé et description', async () => {
    afficher();
    await screen.findByText('Pâtisserie');

    await userEvent.type(screen.getByLabelText(/libellé/i), 'Boulangerie');
    await userEvent.type(
      screen.getByLabelText(/description/i),
      'Pains et viennoiseries'
    );
    await userEvent.click(screen.getByRole('button', { name: /ajouter/i }));

    await waitFor(() =>
      expect(creerDomaine).toHaveBeenCalledWith({
        libelle: 'Boulangerie',
        description: 'Pains et viennoiseries',
      })
    );
  });

  it('normalise une description vide en null', async () => {
    afficher();
    await screen.findByText('Pâtisserie');

    await userEvent.type(screen.getByLabelText(/libellé/i), 'Boulangerie');
    await userEvent.click(screen.getByRole('button', { name: /ajouter/i }));

    await waitFor(() =>
      expect(creerDomaine).toHaveBeenCalledWith({
        libelle: 'Boulangerie',
        description: null,
      })
    );
  });

  it('préremplit le formulaire en édition', async () => {
    afficher();
    await screen.findByText('Pâtisserie');

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }));

    expect(screen.getByLabelText(/libellé/i)).toHaveProperty('value', 'Pâtisserie');
    expect(screen.getByLabelText(/description/i)).toHaveProperty(
      'value',
      'Ateliers pâtisserie'
    );
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDefined();
  });

  it('restaure une archive depuis la liste', async () => {
    afficher();
    await screen.findByText('Pâtisserie');
    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    await userEvent.click(screen.getByRole('button', { name: /restaurer/i }));

    await waitFor(() => expect(restaurerDomaine).toHaveBeenCalledWith(2));
  });
});

describe('refus', () => {
  beforeEach(() => definirSession('personnel'));

  it('reprend tel quel le 409 d’archivage d’un domaine peuplé', async () => {
    vi.mocked(archiverDomaine).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Ce domaine contient encore des formations.' },
      },
    });
    afficher();
    await screen.findByText('Pâtisserie');

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Ce domaine contient encore des formations.'
    );
  });

  it('reprend tel quel le 409 de restauration sur collision', async () => {
    vi.mocked(restaurerDomaine).mockRejectedValue({
      response: {
        status: 409,
        data: {
          detail: 'Un domaine actif porte déjà ce libellé, restauration impossible.',
        },
      },
    });
    afficher();
    await screen.findByText('Pâtisserie');
    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    await userEvent.click(screen.getByRole('button', { name: /restaurer/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /restauration impossible/
    );
  });

  it('rend le 403 lisible', async () => {
    vi.mocked(creerDomaine).mockRejectedValue({ response: { status: 403 } });
    afficher();
    await screen.findByText('Pâtisserie');

    await userEvent.type(screen.getByLabelText(/libellé/i), 'X');
    await userEvent.click(screen.getByRole('button', { name: /ajouter/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/administrateur/i);
  });
});
