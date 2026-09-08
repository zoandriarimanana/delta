/**
 * Tests des hooks d'administration du module réservation.
 *
 * Le module d'API est substitué : ce qui est vérifié ici, c'est
 * l'orchestration des appels et l'état exposé, pas le transport HTTP —
 * couvert par `lib/axiosClient.test.ts`.
 */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  changerStatutAdministration,
  recupererReservationsAdministration,
} from './reservation.api';
import {
  messageDAdministration,
  useActionsReservationAdministration,
  useReservationsAdministration,
} from './reservation.administration';
import type { Reservation } from './reservation.types';

vi.mock('./reservation.api');

const RESERVATION: Reservation = {
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
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('useReservationsAdministration', () => {
  it('charge toutes les réservations', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([RESERVATION]);

    const { result } = renderHook(() => useReservationsAdministration());

    expect(result.current.chargement).toBe(true);
    await waitFor(() => expect(result.current.chargement).toBe(false));

    expect(result.current.reservations).toEqual([RESERVATION]);
  });

  it('recharge sur demande', async () => {
    vi.mocked(recupererReservationsAdministration).mockResolvedValue([RESERVATION]);
    const { result } = renderHook(() => useReservationsAdministration());
    await waitFor(() => expect(result.current.chargement).toBe(false));

    act(() => result.current.recharger());

    await waitFor(() =>
      expect(recupererReservationsAdministration).toHaveBeenCalledTimes(2)
    );
  });

  it('remonte un refus 403 comme un message dédié', async () => {
    vi.mocked(recupererReservationsAdministration).mockRejectedValue({
      response: { status: 403 },
    });

    const { result } = renderHook(() => useReservationsAdministration());

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.erreur).toBe(
      'Cette action est réservée aux administrateurs.'
    );
  });
});

describe('useActionsReservationAdministration', () => {
  it('marquerHonoree appelle l’API avec Honoree, puis recharge', async () => {
    vi.mocked(changerStatutAdministration).mockResolvedValue({
      ...RESERVATION,
      statut: 'Honoree',
    });
    const recharger = vi.fn();
    const { result } = renderHook(() => useActionsReservationAdministration(recharger));

    let ok = false;
    await act(async () => {
      ok = await result.current.marquerHonoree(1);
    });

    expect(ok).toBe(true);
    expect(changerStatutAdministration).toHaveBeenCalledWith(1, 'Honoree');
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('annuler appelle l’API avec Annulee', async () => {
    vi.mocked(changerStatutAdministration).mockResolvedValue({
      ...RESERVATION,
      statut: 'Annulee',
    });
    const recharger = vi.fn();
    const { result } = renderHook(() => useActionsReservationAdministration(recharger));

    await act(async () => {
      await result.current.annuler(1);
    });

    expect(changerStatutAdministration).toHaveBeenCalledWith(1, 'Annulee');
  });

  it('reprend le message 409 tel quel, sans recharger', async () => {
    vi.mocked(changerStatutAdministration).mockRejectedValue({
      response: {
        status: 409,
        data: {
          detail: 'Cette réservation est annulée : son statut ne peut plus changer.',
        },
      },
    });
    const recharger = vi.fn();
    const { result } = renderHook(() => useActionsReservationAdministration(recharger));

    let ok = true;
    await act(async () => {
      ok = await result.current.marquerHonoree(1);
    });

    expect(ok).toBe(false);
    expect(result.current.erreur).toBe(
      'Cette réservation est annulée : son statut ne peut plus changer.'
    );
    expect(recharger).not.toHaveBeenCalled();
  });
});

describe('messageDAdministration', () => {
  it('retombe sur un message dédié pour un refus 403', () => {
    expect(messageDAdministration({ response: { status: 403 } })).toBe(
      'Cette action est réservée aux administrateurs.'
    );
  });

  it('reprend le detail du serveur quand il est une chaîne', () => {
    const erreur = { response: { status: 409, data: { detail: 'Déjà annulée.' } } };

    expect(messageDAdministration(erreur)).toBe('Déjà annulée.');
  });

  it('retombe sur un message générique sans detail exploitable', () => {
    expect(messageDAdministration(new Error('boom'))).toBe(
      'L’opération a échoué. Réessayez dans un instant.'
    );
  });
});
