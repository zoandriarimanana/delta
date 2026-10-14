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
  archiverReservationAdministration,
  changerStatutAdministration,
  recupererReservationsAdministration,
  restaurerReservationAdministration,
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
  await userEvent.click(
    screen.getByRole('button', { name: /confirmer l’annulation/i })
  );

  expect((await screen.findByRole('alert')).textContent).toContain(
    'Cette réservation est annulée'
  );
});

describe('annulation confirmée', () => {
  it('n’appelle rien au premier clic, et « Garder » renonce', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([EN_ATTENTE]);
    afficher();
    await userEvent.click(await screen.findByRole('button', { name: /^annuler$/i }));

    expect(changerStatutAdministration).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /garder/i }));
    expect(screen.getByRole('button', { name: /^annuler$/i })).toBeTruthy();
    expect(changerStatutAdministration).not.toHaveBeenCalled();
  });

  it('annule après confirmation', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([EN_ATTENTE]);
    vi.mocked(changerStatutAdministration).mockResolvedValue({
      ...EN_ATTENTE,
      statut: 'Annulee',
    });
    afficher();
    await userEvent.click(await screen.findByRole('button', { name: /^annuler$/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /confirmer l’annulation/i })
    );

    await waitFor(() =>
      expect(changerStatutAdministration).toHaveBeenCalledWith(1, 'Annulee')
    );
  });
});

it('compte les réservations par statut et filtre au clic', async () => {
  vi.mocked(recupererReservationsAdministration).mockResolvedValue([
    EN_ATTENTE,
    HONOREE,
    ANNULEE,
  ]);
  afficher();
  await screen.findByRole('table');

  await userEvent.click(screen.getByRole('button', { name: /1\s*À confirmer/ }));

  expect(corpsDuTableau().getAllByText('Table').length).toBeGreaterThan(0);
  expect(corpsDuTableau().queryByText('Salle')).toBeNull();
});

describe('confirmer une réservation (13 octobre 2026)', () => {
  it('ne propose « Confirmer » que sur une réservation en attente', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([
      EN_ATTENTE,
      HONOREE,
      ANNULEE,
    ]);
    afficher();

    await screen.findByRole('table');
    expect(screen.getAllByRole('button', { name: /^confirmer$/i })).toHaveLength(1);
  });

  it('confirme via l’API puis recharge la liste', async () => {
    vi.mocked(recupererReservationsAdministration)
      .mockResolvedValueOnce([EN_ATTENTE])
      .mockResolvedValueOnce([{ ...EN_ATTENTE, statut: 'Confirmee' }]);
    vi.mocked(changerStatutAdministration).mockResolvedValue({
      ...EN_ATTENTE,
      statut: 'Confirmee',
    });
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: /^confirmer$/i }));

    await waitFor(() =>
      expect(changerStatutAdministration).toHaveBeenCalledWith(1, 'Confirmee')
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^confirmer$/i })).toBeNull()
    );
  });
});

describe('supprimer une réservation terminée (14 octobre 2026)', () => {
  it('ne propose la corbeille que pour une réservation honorée ou annulée', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([
      EN_ATTENTE,
      HONOREE,
      ANNULEE,
    ]);
    afficher();
    await screen.findByRole('table');

    expect(
      screen.queryByRole('button', { name: /supprimer la réservation n° 1/i })
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: /supprimer la réservation n° 2/i })
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: /supprimer la réservation n° 3/i })
    ).toBeDefined();
  });

  it('archive après confirmation, puis recharge la liste', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([HONOREE]);
    vi.mocked(archiverReservationAdministration).mockResolvedValue(undefined);
    afficher();

    await userEvent.click(
      await screen.findByRole('button', { name: /supprimer la réservation n° 2/i })
    );
    expect(archiverReservationAdministration).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Oui' }));

    await waitFor(() =>
      expect(archiverReservationAdministration).toHaveBeenCalledWith(2)
    );
    await waitFor(() =>
      expect(recupererReservationsAdministration).toHaveBeenCalledTimes(2)
    );
  });

  it('montre les archives à la demande et les restaure', async () => {
    const archivee = { ...ANNULEE, supprime_le: '2026-10-14T08:00:00Z' };
    vi.mocked(recupererReservationsAdministration).mockImplementation(
      async (inclureArchives) => (inclureArchives ? [archivee] : [])
    );
    vi.mocked(restaurerReservationAdministration).mockResolvedValue(ANNULEE);
    afficher();

    await userEvent.click(await screen.findByLabelText(/afficher les archives/i));
    await userEvent.click(await screen.findByRole('button', { name: /restaurer/i }));

    expect(recupererReservationsAdministration).toHaveBeenLastCalledWith(true);
    await waitFor(() =>
      expect(restaurerReservationAdministration).toHaveBeenCalledWith(3)
    );
    // Une archive ne propose plus aucune action de statut.
    expect(screen.queryByRole('button', { name: /^annuler$/i })).toBeNull();
  });
});
