/**
 * Tests de la page d'administration des réservations.
 *
 * Deux points portent l'essentiel : le filtre côté client (aucun paramètre
 * de filtre n'existe côté serveur), et la visibilité des actions selon le
 * statut — une réservation `Annulee` ne doit proposer ni « Marquer honorée »
 * ni « Annuler », le serveur les refuserait de toute façon en 409.
 */

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  changerStatutAdministration,
  recupererReservationsAdministration,
} from '../reservation.api';
import type { Reservation } from '../reservation.types';
import AdministrationReservationsPage from './AdministrationReservationsPage';

function afficher() {
  return render(
    <MemoryRouter>
      <AdministrationReservationsPage />
    </MemoryRouter>
  );
}

vi.mock('../reservation.api');

const EN_ATTENTE: Reservation = {
  id_reservation: 1,
  type_reservation: 'Table',
  date_debut: '2026-09-10T19:00:00Z',
  date_fin: '2026-09-10T21:00:00Z',
  nombre_personnes: 2,
  statut: 'En_attente',
  avec_hebergement: false,
  id_client: 42,
  id_session: null,
  id_salle: null,
  id_logement: null,
  id_reservation_hebergement: null,
};

const HONOREE: Reservation = {
  ...EN_ATTENTE,
  id_reservation: 2,
  type_reservation: 'Formation',
  id_session: 7,
  statut: 'Honoree',
};

const ANNULEE: Reservation = {
  ...EN_ATTENTE,
  id_reservation: 3,
  type_reservation: 'Salle',
  id_salle: 5,
  statut: 'Annulee',
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

/** La table du filtre porte elle-même la valeur "Table" dans une `<option>` :
 * les requêtes de contenu doivent donc se limiter au corps du tableau,
 * jamais à la page entière. */
function corpsDuTableau() {
  return within(screen.getByRole('table'));
}

it('affiche toutes les réservations une fois chargées', async () => {
  vi.mocked(recupererReservationsAdministration).mockResolvedValue([
    EN_ATTENTE,
    HONOREE,
    ANNULEE,
  ]);

  afficher();

  await screen.findByRole('table');
  // « Client n° {id} » est scindé en deux nœuds de texte par l'interpolation
  // JSX : un matcher sur le texte normalisé de la cellule, pas une chaîne
  // exacte, seul capable de les recoller.
  expect(
    corpsDuTableau().getAllByText(
      (_, element) => element?.textContent === 'Client n° 42'
    )
  ).toHaveLength(3);
});

describe('filtres côté client', () => {
  it('filtre par type', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([
      EN_ATTENTE,
      HONOREE,
      ANNULEE,
    ]);
    afficher();
    await screen.findByRole('table');
    expect(corpsDuTableau().getAllByText('Table').length).toBeGreaterThan(0);

    await userEvent.selectOptions(screen.getByLabelText(/^type$/i), 'Formation');

    expect(corpsDuTableau().queryByText('Table')).toBeNull();
    expect(corpsDuTableau().getByText('Formation')).toBeTruthy();
  });

  it('filtre par statut', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([
      EN_ATTENTE,
      HONOREE,
      ANNULEE,
    ]);
    afficher();
    await screen.findByRole('table');

    await userEvent.selectOptions(screen.getByLabelText(/^statut$/i), 'Annulée');

    expect(corpsDuTableau().queryByText('Table')).toBeNull();
    expect(corpsDuTableau().getByText('Salle')).toBeTruthy();
  });
});

describe('visibilité des actions selon le statut', () => {
  it('propose les deux actions sur une réservation En_attente', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([EN_ATTENTE]);
    afficher();

    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: /marquer honorée/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^annuler$/i })).toBeTruthy();
  });

  it('ne propose plus « Marquer honorée » sur une réservation déjà Honoree, mais garde Annuler', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([HONOREE]);
    afficher();

    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /marquer honorée/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^annuler$/i })).toBeTruthy();
  });

  it('ne propose plus aucune action sur une réservation Annulee', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([ANNULEE]);
    afficher();

    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /marquer honorée/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^annuler$/i })).toBeNull();
  });
});

it('clique « Marquer honorée » appelle l’API puis recharge la liste', async () => {
  vi.mocked(recupererReservationsAdministration)
    .mockResolvedValueOnce([EN_ATTENTE])
    .mockResolvedValueOnce([{ ...EN_ATTENTE, statut: 'Honoree' }]);
  vi.mocked(changerStatutAdministration).mockResolvedValue({
    ...EN_ATTENTE,
    statut: 'Honoree',
  });
  afficher();
  await screen.findByRole('button', { name: /marquer honorée/i });

  await userEvent.click(screen.getByRole('button', { name: /marquer honorée/i }));

  await waitFor(() =>
    expect(changerStatutAdministration).toHaveBeenCalledWith(1, 'Honoree')
  );
  await waitFor(() =>
    expect(recupererReservationsAdministration).toHaveBeenCalledTimes(2)
  );
});

it('reprend le refus 409 tel quel', async () => {
  vi.mocked(recupererReservationsAdministration).mockResolvedValue([EN_ATTENTE]);
  vi.mocked(changerStatutAdministration).mockRejectedValue({
    response: {
      status: 409,
      data: {
        detail: 'Cette réservation est annulée : son statut ne peut plus changer.',
      },
    },
  });
  afficher();
  await screen.findByRole('button', { name: /^annuler$/i });

  await userEvent.click(screen.getByRole('button', { name: /^annuler$/i }));

  expect((await screen.findByRole('alert')).textContent).toContain(
    'Cette réservation est annulée'
  );
});
