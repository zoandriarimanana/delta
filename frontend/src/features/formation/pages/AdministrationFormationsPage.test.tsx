/**
 * Tests de l'écran d'administration des formations — liste.
 *
 * **Aucune action destructive ici** : modifier, archiver, restaurer vivent
 * sur la fiche, pas sur cette liste — c'est ce que ce fichier vérifie en
 * creux, en ne cherchant jamais ces boutons ici. Même patron que
 * `AdministrationPersonnelPage.test.tsx`.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RoutePersonnel from '@/lib/RoutePersonnel';
import { definirSession, effacerSession } from '@/lib/session.store';

import {
  creerFormation,
  recupererDomainesAdministration,
  recupererFormationsAdministration,
} from '../formation.api';
import AdministrationFormationsPage from './AdministrationFormationsPage';

vi.mock('../formation.api');

const DOMAINE = {
  id_domaine: 1,
  libelle: 'Pâtisserie',
  description: null,
  supprime_le: null,
};

const ACTIVE = {
  id_formation: 1,
  titre: 'CAP Pâtissier',
  niveau: null,
  duree_heures: 140,
  prix: '850000.00',
  capacite_max: 12,
  propose_hebergement: false,
  id_domaine: 1,
  note_moyenne: null,
  nombre_avis: 0,
  supprime_le: null,
};

const ARCHIVEE = {
  ...ACTIVE,
  id_formation: 2,
  titre: 'Formation Archivée',
  supprime_le: '2026-09-03T08:12:44Z',
};

function afficherSousGarde() {
  return render(
    <MemoryRouter initialEntries={['/personnel/formations']}>
      <Routes>
        <Route
          path="/personnel/formations"
          element={
            <RoutePersonnel>
              <AdministrationFormationsPage />
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
      <AdministrationFormationsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  effacerSession();
  vi.mocked(recupererFormationsAdministration).mockResolvedValue([ACTIVE, ARCHIVEE]);
  vi.mocked(recupererDomainesAdministration).mockResolvedValue([DOMAINE]);
  vi.mocked(creerFormation).mockResolvedValue(ACTIVE);
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
    expect(recupererFormationsAdministration).not.toHaveBeenCalled();
  });

  it('refuse un visiteur non connecté', () => {
    afficherSousGarde();

    expect(screen.getByText('connexion personnel')).toBeDefined();
  });

  it('ouvre l’écran pour un salarié', () => {
    definirSession('personnel');

    afficherSousGarde();

    expect(
      screen.getByRole('heading', { name: /administration des formations/i })
    ).toBeDefined();
  });
});

describe('liste', () => {
  beforeEach(() => definirSession('personnel'));

  it('masque les archives par défaut et les compte', async () => {
    afficher();

    expect(await screen.findByText('CAP Pâtissier')).toBeDefined();
    expect(screen.queryByText('Formation Archivée')).toBeNull();
    expect(screen.getByLabelText(/afficher les archives \(1\)/i)).toBeDefined();
  });

  it('les affiche à la demande', async () => {
    afficher();
    await screen.findByText('CAP Pâtissier');

    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    expect(screen.getByText('Formation Archivée')).toBeDefined();
  });

  it('résout le libellé du domaine sur chaque ligne', async () => {
    afficher();

    expect(await screen.findByText('Pâtisserie')).toBeDefined();
  });

  it('affiche une vignette déterministe par formation', async () => {
    afficher();
    await screen.findByText('CAP Pâtissier');

    const ligne = screen.getByText('CAP Pâtissier').closest('tr');
    const image = ligne?.querySelector('img');

    expect(image?.getAttribute('src')).toMatch(/^https:\/\/images\.unsplash\.com\//);
  });

  it('ne propose aucune action inline, seulement un lien vers la fiche', async () => {
    afficher();
    await screen.findByText('CAP Pâtissier');

    const ligne = screen.getByText('CAP Pâtissier').closest('tr');
    expect(ligne?.textContent?.toLowerCase()).not.toContain('archiver');
    expect(ligne?.textContent?.toLowerCase()).not.toContain('modifier');
    expect(screen.getByRole('link', { name: /voir la fiche/i })).toHaveProperty(
      'href',
      expect.stringContaining('/personnel/formations/1')
    );
  });

  it('propose un lien vers la gestion des domaines', async () => {
    afficher();

    expect(screen.getByRole('link', { name: /gérer les domaines/i })).toHaveProperty(
      'href',
      expect.stringContaining('/personnel/domaines-formation')
    );
  });
});

describe('création', () => {
  beforeEach(() => definirSession('personnel'));

  it('crée une formation', async () => {
    afficher();
    await screen.findByText('CAP Pâtissier');

    await userEvent.click(screen.getByRole('button', { name: /nouvelle formation/i }));
    await userEvent.type(screen.getByLabelText(/^titre$/i), 'Boulangerie de base');
    await userEvent.click(screen.getByRole('button', { name: /^créer$/i }));

    await waitFor(() =>
      expect(creerFormation).toHaveBeenCalledWith(
        expect.objectContaining({ titre: 'Boulangerie de base' })
      )
    );
  });

  it('rend le 403 lisible', async () => {
    vi.mocked(creerFormation).mockRejectedValue({ response: { status: 403 } });
    afficher();
    await screen.findByText('CAP Pâtissier');

    await userEvent.click(screen.getByRole('button', { name: /nouvelle formation/i }));
    await userEvent.type(screen.getByLabelText(/^titre$/i), 'X');
    await userEvent.click(screen.getByRole('button', { name: /^créer$/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/administrateur/i);
  });
});
