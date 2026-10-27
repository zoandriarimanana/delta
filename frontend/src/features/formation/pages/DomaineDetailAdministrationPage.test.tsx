/** Fiche d'administration d'un domaine : ses formations, ses actions. */

import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  archiverDomaine,
  modifierDomaine,
  recupererDomainesAdministration,
  recupererFormationsAdministration,
} from '../formation.api';
import AdministrationDomainesPage from './AdministrationDomainesPage';
import DomaineDetailAdministrationPage from './DomaineDetailAdministrationPage';

vi.mock('../formation.api');

const DOMAINE = {
  id_domaine: 1,
  libelle: 'Pâtisserie',
  description: 'Formations en laboratoire.',
  supprime_le: null,
};
const FORMATION = {
  id_formation: 7,
  titre: 'Initiation',
  niveau: 'Débutant',
  duree_heures: 20,
  prix: '450000.00',
  capacite_max: 12,
  propose_hebergement: true,
  description: null,
  id_domaine: 1,
  note_moyenne: null,
  nombre_avis: 0,
  supprime_le: null,
};

function afficher(chemin = '/personnel/domaines-formation/1') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route
          path="/personnel/domaines-formation"
          element={<AdministrationDomainesPage />}
        />
        <Route
          path="/personnel/domaines-formation/:idDomaine"
          element={<DomaineDetailAdministrationPage />}
        />
        <Route
          path="/personnel/formations/:idFormation"
          element={<p>Fiche formation</p>}
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(recupererDomainesAdministration).mockResolvedValue([DOMAINE]);
  vi.mocked(recupererFormationsAdministration).mockResolvedValue([
    FORMATION,
    { ...FORMATION, id_formation: 8, titre: 'Cuisine malgache', id_domaine: 2 },
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('DomaineDetailAdministrationPage', () => {
  it('affiche la description et les seules formations du domaine', async () => {
    afficher();

    expect(await screen.findByRole('heading', { name: 'Pâtisserie' })).toBeTruthy();
    expect(screen.getByText('Formations en laboratoire.')).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Initiation' })).toBeTruthy();
    expect(screen.queryByText('Cuisine malgache')).toBeNull();
  });

  it('une formation mène à sa fiche', async () => {
    afficher();

    await userEvent.click(await screen.findByText('Débutant'));

    expect(await screen.findByText('Fiche formation')).toBeTruthy();
  });

  it('un clic sur un domaine de la liste ouvre sa fiche', async () => {
    afficher('/personnel/domaines-formation');

    await userEvent.click(await screen.findByText('Formations en laboratoire.'));

    expect(
      await screen.findByRole('heading', { name: 'Formations du domaine' })
    ).toBeTruthy();
  });

  it('modifie le libellé et la description depuis la fiche', async () => {
    vi.mocked(modifierDomaine).mockResolvedValue(DOMAINE);
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    const libelle = screen.getByLabelText('Libellé');
    await userEvent.clear(libelle);
    await userEvent.type(libelle, 'Pâtisserie fine');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(modifierDomaine).toHaveBeenCalledWith(1, {
      libelle: 'Pâtisserie fine',
      description: 'Formations en laboratoire.',
    });
  });

  it('reprend tel quel le refus d’archivage', async () => {
    vi.mocked(archiverDomaine).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Ce domaine contient encore des formations.' },
      },
    });
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }));

    expect(
      await screen.findByText('Ce domaine contient encore des formations.')
    ).toBeTruthy();
  });
});
