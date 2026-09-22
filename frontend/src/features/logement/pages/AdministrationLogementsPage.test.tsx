/**
 * Tests de l'écran d'administration des logements.
 *
 * Quatre garanties, dont aucune ne repose sur le masquage d'un lien :
 *
 * - un **jeton client** n'ouvre pas l'écran ;
 * - les **archives** sont affichables et **restaurables** ;
 * - le vocabulaire dit **« archiver »**, jamais « supprimer » ;
 * - le **403** d'un salarié sans droit est rendu lisible.
 *
 * Même patron que `AdministrationSallesPage.test.tsx`.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RoutePersonnel from '@/lib/RoutePersonnel';
import { definirSession, effacerSession } from '@/lib/session.store';

import {
  archiverLogement,
  recupererLogementsAdministration,
  restaurerLogement,
} from '../logement.api';
import AdministrationLogementsPage from './AdministrationLogementsPage';

vi.mock('../logement.api');

const ACTIF = {
  id_logement: 1,
  type_chambre: 'Simple',
  capacite: 1,
  tarif_nuitee: '20000.00',
  statut: 'Disponible' as const,
  note_moyenne: null,
  nombre_avis: 0,
  supprime_le: null,
};

const ARCHIVE = {
  ...ACTIF,
  id_logement: 2,
  type_chambre: 'Double',
  supprime_le: '2026-09-03T08:12:44Z',
};

function afficherSousGarde() {
  return render(
    <MemoryRouter initialEntries={['/personnel/logements']}>
      <Routes>
        <Route
          path="/personnel/logements"
          element={
            <RoutePersonnel>
              <AdministrationLogementsPage />
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
      <AdministrationLogementsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  effacerSession();
  vi.mocked(recupererLogementsAdministration).mockResolvedValue([ACTIF, ARCHIVE]);
  vi.mocked(archiverLogement).mockResolvedValue(undefined);
  vi.mocked(restaurerLogement).mockResolvedValue(ACTIF);
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
    expect(recupererLogementsAdministration).not.toHaveBeenCalled();
  });

  it('refuse un visiteur non connecté', () => {
    afficherSousGarde();

    expect(screen.getByText('connexion personnel')).toBeDefined();
  });

  it('ouvre l’écran pour un salarié', () => {
    definirSession('personnel');

    afficherSousGarde();

    expect(
      screen.getByRole('heading', { name: /administration des logements/i })
    ).toBeDefined();
  });
});

describe('vignette', () => {
  beforeEach(() => definirSession('personnel'));

  it('affiche une image déterministe par logement, réutilisant imagePour', async () => {
    afficher();
    await screen.findByText('Simple');

    const ligne = screen.getByText('Simple').closest('tr');
    const image = ligne?.querySelector('img');

    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toMatch(/^https:\/\/images\.unsplash\.com\//);
  });
});

describe('statut métier', () => {
  beforeEach(() => definirSession('personnel'));

  it('affiche le statut du logement, distinct de son état d’archivage', async () => {
    afficher();
    await screen.findByText('Simple');

    const ligne = screen.getByText('Simple').closest('tr');

    expect(ligne?.textContent).toContain('Disponible');
    expect(ligne?.textContent).toContain('Actif');
  });
});

describe('archives', () => {
  beforeEach(() => definirSession('personnel'));

  it('les masque par défaut', async () => {
    afficher();

    expect(await screen.findByText('Simple')).toBeDefined();
    expect(screen.queryByText('Double')).toBeNull();
  });

  it('les affiche à la demande, et compte combien il y en a', async () => {
    afficher();
    await screen.findByText('Simple');

    await userEvent.click(screen.getByLabelText(/afficher les archives \(1\)/i));

    expect(screen.getByText('Double')).toBeDefined();
  });

  it('propose « Restaurer » sur une archive, jamais « Archiver »', async () => {
    afficher();
    await screen.findByText('Simple');
    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    const ligne = screen.getByText('Double').closest('tr');

    expect(ligne?.textContent).toContain('Restaurer');
    expect(ligne?.textContent).not.toContain('Archiver');
  });

  it('restaure depuis la liste', async () => {
    afficher();
    await screen.findByText('Simple');
    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    await userEvent.click(screen.getByRole('button', { name: /restaurer/i }));

    await waitFor(() => expect(restaurerLogement).toHaveBeenCalledWith(2));
  });
});

describe('vocabulaire', () => {
  beforeEach(() => definirSession('personnel'));

  it('dit « archiver », jamais « supprimer »', async () => {
    const { container } = afficher();
    await screen.findByText('Simple');

    expect(screen.getByRole('button', { name: /archiver/i })).toBeDefined();
    expect(container.textContent?.toLowerCase()).not.toContain('supprimer');
  });

  it('archive le logement choisi', async () => {
    afficher();
    await screen.findByText('Simple');

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    await waitFor(() => expect(archiverLogement).toHaveBeenCalledWith(1));
  });
});

describe('refus du serveur', () => {
  beforeEach(() => definirSession('personnel'));

  it('rend le 403 lisible', async () => {
    vi.mocked(archiverLogement).mockRejectedValue({ response: { status: 403 } });
    afficher();
    await screen.findByText('Simple');

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/administrateur/i);
  });

  it('reprend le message du 409 tel quel', async () => {
    vi.mocked(archiverLogement).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Ce logement porte encore des réservations actives.' },
      },
    });
    afficher();
    await screen.findByText('Simple');

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Ce logement porte encore des réservations actives.'
    );
  });
});
