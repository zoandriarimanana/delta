/**
 * Tests de la fiche d'administration d'une formation.
 *
 * **Dérivée de la liste d'administration**, pas d'un `GET` dédié : aucune
 * route `/formations/administration/{id}` n'existe côté serveur. Le point à
 * vérifier est donc que la fiche retrouve correctement sa formation dans la
 * liste complète, y compris archivée.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RoutePersonnel from '@/lib/RoutePersonnel';
import { definirSession, effacerSession } from '@/lib/session.store';

import {
  archiverFormation,
  modifierFormation,
  recupererDomainesAdministration,
  recupererFormationsAdministration,
  restaurerFormation,
} from '../formation.api';
import FormationDetailAdministrationPage from './FormationDetailAdministrationPage';

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
  niveau: 'Débutant',
  duree_heures: 140,
  prix: '850000.00',
  capacite_max: 12,
  propose_hebergement: true,
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

function afficher(chemin = '/personnel/formations/1') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route
          path="/personnel/formations/:idFormation"
          element={
            <RoutePersonnel>
              <FormationDetailAdministrationPage />
            </RoutePersonnel>
          }
        />
        <Route path="/personnel/connexion" element={<p>connexion personnel</p>} />
        <Route path="/personnel/formations" element={<p>liste formations</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  definirSession('personnel');
  vi.mocked(recupererFormationsAdministration).mockResolvedValue([ACTIVE, ARCHIVEE]);
  vi.mocked(recupererDomainesAdministration).mockResolvedValue([DOMAINE]);
  vi.mocked(modifierFormation).mockResolvedValue(ACTIVE);
  vi.mocked(archiverFormation).mockResolvedValue(undefined);
  vi.mocked(restaurerFormation).mockResolvedValue(ACTIVE);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerSession();
});

describe('accès', () => {
  it('refuse un jeton client', () => {
    definirSession('client');

    afficher();

    expect(screen.getByText('connexion personnel')).toBeDefined();
  });
});

describe('affichage', () => {
  it('affiche les informations de la formation', async () => {
    afficher();

    expect(await screen.findByRole('heading', { name: 'CAP Pâtissier' })).toBeDefined();
    expect(screen.getByText('Pâtisserie')).toBeDefined();
    expect(screen.getByText('Débutant')).toBeDefined();
  });

  it('affiche une vignette', async () => {
    afficher();
    await screen.findByRole('heading', { name: 'CAP Pâtissier' });

    const image = document.querySelector('img');
    expect(image?.getAttribute('src')).toMatch(/^https:\/\/images\.unsplash\.com\//);
  });

  it('retrouve une formation archivée, invisible via la route publique', async () => {
    // Le point central : pas de 404 sur une formation archivée, contrairement
    // à ce qu'un GET /formations/{id} public donnerait.
    afficher('/personnel/formations/2');

    expect(
      await screen.findByRole('heading', { name: 'Formation Archivée' })
    ).toBeDefined();
    expect(screen.getByText('Archivée')).toBeDefined();
  });

  it('affiche une erreur pour une formation inconnue', async () => {
    afficher('/personnel/formations/999');

    expect(await screen.findByRole('alert')).toBeDefined();
  });
});

describe('modification', () => {
  it('modifie la formation', async () => {
    afficher();
    await screen.findByRole('heading', { name: 'CAP Pâtissier' });

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }));
    await userEvent.clear(screen.getByLabelText(/^titre$/i));
    await userEvent.type(screen.getByLabelText(/^titre$/i), 'CAP Pâtissier (révisé)');
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(modifierFormation).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ titre: 'CAP Pâtissier (révisé)' })
      )
    );
  });
});

describe('archivage et restauration', () => {
  it('archive la formation active', async () => {
    afficher();
    await screen.findByRole('heading', { name: 'CAP Pâtissier' });

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    await waitFor(() => expect(archiverFormation).toHaveBeenCalledWith(1));
  });

  it('propose « Restaurer » sur une formation archivée, jamais « Archiver »', async () => {
    afficher('/personnel/formations/2');

    await screen.findByRole('heading', { name: 'Formation Archivée' });

    expect(screen.getByRole('button', { name: /restaurer/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^archiver$/i })).toBeNull();
  });

  it('restaure une formation archivée', async () => {
    afficher('/personnel/formations/2');
    await screen.findByRole('heading', { name: 'Formation Archivée' });

    await userEvent.click(screen.getByRole('button', { name: /restaurer/i }));

    await waitFor(() => expect(restaurerFormation).toHaveBeenCalledWith(2));
  });
});

describe('refus', () => {
  it('rend le 403 lisible', async () => {
    vi.mocked(archiverFormation).mockRejectedValue({ response: { status: 403 } });
    afficher();
    await screen.findByRole('heading', { name: 'CAP Pâtissier' });

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/administrateur/i);
  });
});
