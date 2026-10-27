/** Fiche d'administration d'un logement : état du bien, tarif, réservations. */

import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recupererReservationsAdministration } from '@/features/reservation/reservation.api';

import { recupererLogement, recupererLogementsAdministration } from '../logement.api';
import AdministrationLogementsPage from './AdministrationLogementsPage';
import LogementDetailAdministrationPage from './LogementDetailAdministrationPage';

vi.mock('../logement.api');
vi.mock('@/features/reservation/reservation.api');

const LOGEMENT = {
  id_logement: 2,
  type_chambre: 'double',
  description: null,
  capacite: 2,
  tarif_nuitee: '80000.00',
  statut: 'En_maintenance' as const,
  note_moyenne: null,
  nombre_avis: 0,
  supprime_le: null,
};

function afficher(chemin = '/personnel/logements/2') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/personnel/logements" element={<AdministrationLogementsPage />} />
        <Route
          path="/personnel/logements/:idLogement"
          element={<LogementDetailAdministrationPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(recupererLogementsAdministration).mockResolvedValue([LOGEMENT]);
  vi.mocked(recupererLogement).mockResolvedValue(LOGEMENT);
  vi.mocked(recupererReservationsAdministration).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('LogementDetailAdministrationPage', () => {
  it('affiche l’état du bien, la capacité et le tarif', async () => {
    afficher();

    expect(await screen.findByRole('heading', { name: 'Chambre double' })).toBeTruthy();
    expect(screen.getByText('Temporairement indisponible')).toBeTruthy();
    expect(screen.getByText('2 personne(s)')).toBeTruthy();
    expect(screen.getByText(/80/)).toBeTruthy();
  });

  it('dit quand aucune réservation n’existe', async () => {
    afficher();

    expect(await screen.findByText('Aucune réservation pour le moment.')).toBeTruthy();
  });

  it('un clic sur une ligne de la liste ouvre la fiche', async () => {
    afficher('/personnel/logements');

    await userEvent.click(await screen.findByText('2 pers.'));

    expect(await screen.findByRole('heading', { name: 'Chambre double' })).toBeTruthy();
  });
});
