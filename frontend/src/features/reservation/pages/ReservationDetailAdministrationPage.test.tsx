/**
 * Tests de la fiche réservation, administration.
 *
 * Le point central : les deux actions n'apparaissent que sous les mêmes
 * conditions que sur `AdministrationReservationsPage` (tableau) — les deux
 * vues partagent `peutMarquerHonoree`/`peutAnnuler`
 * (`reservation.service.ts`), ce test le vérifie sur la fiche sans dupliquer
 * la couverture déjà faite sur le tableau (`AdministrationReservationsPage.test.tsx`).
 */

import { MemoryRouter, Route, Routes } from 'react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recupererSalle } from '@/features/salle/salle.api';
import type { Salle } from '@/features/salle/salle.types';

import {
  changerStatutAdministration,
  recupererReservationAdministration,
} from '../reservation.api';
import type { Reservation } from '../reservation.types';
import ReservationDetailAdministrationPage from './ReservationDetailAdministrationPage';

vi.mock('../reservation.api');
vi.mock('@/features/salle/salle.api');
vi.mock('@/features/logement/logement.api');
vi.mock('@/features/formation/formation.api');

const RESERVATION_SALLE: Reservation = {
  id_reservation: 5,
  type_reservation: 'Salle',
  date_debut: '2026-10-09T10:00:00Z',
  date_fin: '2026-10-09T12:00:00Z',
  nombre_personnes: 8,
  statut: 'En_attente',
  avec_hebergement: false,
  id_client: 1,
  id_session: null,
  id_salle: 1,
  id_logement: null,
  id_reservation_hebergement: null,
};

const SALLE: Salle = {
  id_salle: 1,
  nom: 'Salle de conférence QA',
  capacite: 40,
  tarif_horaire: '15000.00',
  tarif_journee: null,
  equipements: 'Vidéoprojecteur',
  note_moyenne: null,
  nombre_avis: 0,
};

function afficher() {
  render(
    <MemoryRouter initialEntries={['/personnel/reservations/5']}>
      <Routes>
        <Route
          path="/personnel/reservations/:idReservation"
          element={<ReservationDetailAdministrationPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('affiche le détail de la cible (Salle) une fois chargée', async () => {
  vi.mocked(recupererReservationAdministration).mockResolvedValue(RESERVATION_SALLE);
  vi.mocked(recupererSalle).mockResolvedValue(SALLE);

  afficher();

  expect(
    await screen.findByRole('heading', { name: /réservation n° 5/i })
  ).toBeTruthy();
  expect(await screen.findByText('Salle de conférence QA')).toBeTruthy();
  expect(screen.getByText('40 personnes')).toBeTruthy();
  expect(recupererSalle).toHaveBeenCalledWith(1);
});

it('affiche le message d’erreur du serveur si la réservation est introuvable', async () => {
  vi.mocked(recupererReservationAdministration).mockRejectedValue({
    response: { status: 404, data: { detail: 'Réservation introuvable.' } },
  });

  afficher();

  expect((await screen.findByRole('alert')).textContent).toContain(
    'Réservation introuvable.'
  );
});

describe('actions — mêmes conditions que le tableau', () => {
  it('propose les deux actions sur une réservation En_attente', async () => {
    vi.mocked(recupererReservationAdministration).mockResolvedValue(RESERVATION_SALLE);
    vi.mocked(recupererSalle).mockResolvedValue(SALLE);

    afficher();

    expect(
      await screen.findByRole('button', { name: /marquer honorée/i })
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^annuler$/i })).toBeTruthy();
  });

  it('ne propose plus « Marquer honorée » sur une réservation Honoree, garde Annuler', async () => {
    vi.mocked(recupererReservationAdministration).mockResolvedValue({
      ...RESERVATION_SALLE,
      statut: 'Honoree',
    });
    vi.mocked(recupererSalle).mockResolvedValue(SALLE);

    afficher();

    await screen.findByRole('button', { name: /^annuler$/i });
    expect(screen.queryByRole('button', { name: /marquer honorée/i })).toBeNull();
  });

  it('ne propose plus aucune action sur une réservation Annulee', async () => {
    vi.mocked(recupererReservationAdministration).mockResolvedValue({
      ...RESERVATION_SALLE,
      statut: 'Annulee',
    });
    vi.mocked(recupererSalle).mockResolvedValue(SALLE);

    afficher();

    await screen.findByText('Salle de conférence QA');
    expect(screen.queryByRole('button', { name: /marquer honorée/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^annuler$/i })).toBeNull();
  });

  it('clique « Marquer honorée » appelle l’API puis recharge la fiche', async () => {
    vi.mocked(recupererReservationAdministration)
      .mockResolvedValueOnce(RESERVATION_SALLE)
      .mockResolvedValueOnce({ ...RESERVATION_SALLE, statut: 'Honoree' });
    vi.mocked(recupererSalle).mockResolvedValue(SALLE);
    vi.mocked(changerStatutAdministration).mockResolvedValue({
      ...RESERVATION_SALLE,
      statut: 'Honoree',
    });

    afficher();
    await screen.findByRole('button', { name: /marquer honorée/i });

    await userEvent.click(screen.getByRole('button', { name: /marquer honorée/i }));

    await waitFor(() =>
      expect(changerStatutAdministration).toHaveBeenCalledWith(5, 'Honoree')
    );
    await waitFor(() =>
      expect(recupererReservationAdministration).toHaveBeenCalledTimes(2)
    );
  });
});
