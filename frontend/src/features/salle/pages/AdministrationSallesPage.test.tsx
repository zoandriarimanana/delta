/**
 * Tests de l'écran d'administration des salles.
 *
 * Quatre garanties, dont aucune ne repose sur le masquage d'un lien :
 *
 * - un **jeton client** n'ouvre pas l'écran ;
 * - les **archives** sont affichables et **restaurables** — c'est ce que la
 *   tâche backend (#142) a rendu possible ;
 * - le vocabulaire dit **« archiver »**, jamais « supprimer » ;
 * - le **403** d'un salarié sans droit est rendu lisible.
 *
 * Même patron que `AdministrationProduitsPage.test.tsx`.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RoutePersonnel from '@/lib/RoutePersonnel';
import { definirSession, effacerSession } from '@/lib/session.store';

import {
  archiverSalle,
  recupererSallesAdministration,
  restaurerSalle,
} from '../salle.api';
import AdministrationSallesPage from './AdministrationSallesPage';

vi.mock('../salle.api');

const ACTIVE = {
  id_salle: 1,
  nom: 'Salle Zafy',
  capacite: 20,
  tarif_horaire: '15000.00',
  tarif_journee: null,
  equipements: null,
  note_moyenne: null,
  nombre_avis: 0,
  supprime_le: null,
};

const ARCHIVEE = {
  ...ACTIVE,
  id_salle: 2,
  nom: 'Salle Andriana',
  supprime_le: '2026-09-03T08:12:44Z',
};

function afficherSousGarde() {
  return render(
    <MemoryRouter initialEntries={['/personnel/salles']}>
      <Routes>
        <Route
          path="/personnel/salles"
          element={
            <RoutePersonnel>
              <AdministrationSallesPage />
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
      <AdministrationSallesPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  effacerSession();
  vi.mocked(recupererSallesAdministration).mockResolvedValue([ACTIVE, ARCHIVEE]);
  vi.mocked(archiverSalle).mockResolvedValue(undefined);
  vi.mocked(restaurerSalle).mockResolvedValue(ACTIVE);
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
    expect(recupererSallesAdministration).not.toHaveBeenCalled();
  });

  it('refuse un visiteur non connecté', () => {
    afficherSousGarde();

    expect(screen.getByText('connexion personnel')).toBeDefined();
  });

  it('ouvre l’écran pour un salarié', () => {
    // Contrôle positif : sans lui, une garde refusant tout passerait les
    // deux tests ci-dessus.
    definirSession('personnel');

    afficherSousGarde();

    expect(
      screen.getByRole('heading', { name: /administration des salles/i })
    ).toBeDefined();
  });
});

describe('vignette', () => {
  beforeEach(() => definirSession('personnel'));

  it('affiche une image déterministe par salle, réutilisant imagePour', async () => {
    // Le mécanisme est déjà utilisé côté public (`SalleListPage`) : pas de
    // nouvelle logique ici, seulement sa réutilisation.
    afficher();
    await screen.findByText('Salle Zafy');

    const ligne = screen.getByText('Salle Zafy').closest('tr');
    const image = ligne?.querySelector('img');

    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toMatch(/^https:\/\/images\.unsplash\.com\//);
  });
});

describe('archives', () => {
  beforeEach(() => definirSession('personnel'));

  it('les masque par défaut', async () => {
    afficher();

    expect(await screen.findByText('Salle Zafy')).toBeDefined();
    expect(screen.queryByText('Salle Andriana')).toBeNull();
  });

  it('les affiche à la demande, et compte combien il y en a', async () => {
    afficher();
    await screen.findByText('Salle Zafy');

    await userEvent.click(screen.getByLabelText(/afficher les archives \(1\)/i));

    expect(screen.getByText('Salle Andriana')).toBeDefined();
  });

  it('propose « Restaurer » sur une archive, jamais « Archiver »', async () => {
    afficher();
    await screen.findByText('Salle Zafy');
    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    const ligne = screen.getByText('Salle Andriana').closest('tr');

    expect(ligne?.textContent).toContain('Restaurer');
    expect(ligne?.textContent).not.toContain('Archiver');
  });

  it('restaure depuis la liste', async () => {
    afficher();
    await screen.findByText('Salle Zafy');
    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    await userEvent.click(screen.getByRole('button', { name: /restaurer/i }));

    await waitFor(() => expect(restaurerSalle).toHaveBeenCalledWith(2));
  });
});

describe('vocabulaire', () => {
  beforeEach(() => definirSession('personnel'));

  it('dit « archiver », jamais « supprimer »', async () => {
    const { container } = afficher();
    await screen.findByText('Salle Zafy');

    expect(screen.getByRole('button', { name: /archiver/i })).toBeDefined();
    expect(container.textContent?.toLowerCase()).not.toContain('supprimer');
  });

  it('archive la salle choisie', async () => {
    afficher();
    await screen.findByText('Salle Zafy');

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    await waitFor(() => expect(archiverSalle).toHaveBeenCalledWith(1));
  });
});

describe('refus du serveur', () => {
  beforeEach(() => definirSession('personnel'));

  it('rend le 403 lisible', async () => {
    vi.mocked(archiverSalle).mockRejectedValue({ response: { status: 403 } });
    afficher();
    await screen.findByText('Salle Zafy');

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/administrateur/i);
  });

  it('reprend le message du 409 tel quel', async () => {
    vi.mocked(archiverSalle).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Cette salle porte encore des réservations actives.' },
      },
    });
    afficher();
    await screen.findByText('Salle Zafy');

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Cette salle porte encore des réservations actives.'
    );
  });
});
