/**
 * Fiche d'administration d'une salle : champs, note, et réservations de cette
 * salle seulement — rendues par le module `reservation`.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recupererReservationsAdministration } from '@/features/reservation/reservation.api';
import type { Reservation } from '@/features/reservation/reservation.types';

import { recupererSalle, recupererSallesAdministration } from '../salle.api';
import AdministrationSallesPage from './AdministrationSallesPage';
import SalleDetailAdministrationPage from './SalleDetailAdministrationPage';

vi.mock('../salle.api');
vi.mock('@/features/reservation/reservation.api');

const SALLE = {
  id_salle: 3,
  nom: 'Salle Ravinala',
  capacite: 40,
  tarif_horaire: null,
  tarif_journee: '300000.00',
  equipements: 'vidéoprojecteur, sonorisation',
  description: null,
  note_moyenne: null,
  nombre_avis: 0,
  supprime_le: null,
};

function reservation(id: number, champs: Partial<Reservation>): Reservation {
  return {
    id_reservation: id,
    type_reservation: 'Salle',
    date_debut: '2099-11-09T08:00:00Z',
    date_fin: '2099-11-09T12:00:00Z',
    nombre_personnes: 25,
    statut: 'Confirmee',
    avec_hebergement: false,
    id_client: 1,
    id_session: null,
    id_salle: 3,
    id_logement: null,
    id_reservation_hebergement: null,
    ...champs,
  } as Reservation;
}

function afficher(chemin = '/personnel/salles/3') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/personnel/salles" element={<AdministrationSallesPage />} />
        <Route
          path="/personnel/salles/:idSalle"
          element={<SalleDetailAdministrationPage />}
        />
        <Route path="/personnel/reservations/:id" element={<p>Fiche réservation</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(recupererSallesAdministration).mockResolvedValue([SALLE]);
  vi.mocked(recupererSalle).mockResolvedValue({
    ...SALLE,
    note_moyenne: '4.00',
    nombre_avis: 3,
  });
  vi.mocked(recupererReservationsAdministration).mockResolvedValue([
    reservation(11, {}),
    reservation(12, { id_salle: 9 }),
    reservation(13, { id_salle: null, id_logement: 3, type_reservation: 'Logement' }),
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('SalleDetailAdministrationPage', () => {
  it('affiche les champs et la note', async () => {
    afficher();

    expect(await screen.findByRole('heading', { name: 'Salle Ravinala' })).toBeTruthy();
    expect(screen.getByText('40 personnes')).toBeTruthy();
    expect(screen.getByText('Non loué à l’heure')).toBeTruthy();
    expect(screen.getByText('vidéoprojecteur, sonorisation')).toBeTruthy();
    expect(await screen.findByText(/3 avis/)).toBeTruthy();
  });

  it('liste les seules réservations de cette salle, et mène à leur fiche', async () => {
    afficher();

    expect(await screen.findByText(/1 réservation\(s\), dont 1 à venir/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '#11' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: '#12' })).toBeNull();
    // #13 porte le même identifiant, mais sur un logement : exclue.
    expect(screen.queryByRole('link', { name: '#13' })).toBeNull();

    await userEvent.click(screen.getByRole('link', { name: '#11' }));
    expect(await screen.findByText('Fiche réservation')).toBeTruthy();
  });

  it('un clic sur une ligne de la liste ouvre la fiche', async () => {
    afficher('/personnel/salles');

    await userEvent.click(await screen.findByText('40 pers.'));

    expect(await screen.findByRole('heading', { name: 'Salle Ravinala' })).toBeTruthy();
  });
});
