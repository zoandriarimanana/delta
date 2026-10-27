/**
 * Tests des hooks de suivi.
 *
 * Le point le plus important est le traitement du **404** : il signifie « pas de
 * livraison pour cette commande » dans le cas courant — un retrait sur place —
 * et l'afficher comme une panne inquiéterait pour rien.
 */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recupererSuivi, recupererSuiviInvite } from './livraison.api';
import { useSuiviLivraison, useSuiviLivraisonInvitee } from './livraison.hooks';
import type { SuiviLivraison } from './livraison.types';

vi.mock('./livraison.api');

const SUIVI: SuiviLivraison = {
  statut: 'En_cours',
  date_heure_prevue: '2026-08-05T14:00:00+00:00',
  date_heure_reelle: null,
};

function erreurHttp(status: number) {
  return { response: { status } };
}

beforeEach(() => {
  vi.mocked(recupererSuivi).mockResolvedValue(SUIVI);
  vi.mocked(recupererSuiviInvite).mockResolvedValue(SUIVI);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('useSuiviLivraison', () => {
  it('charge le suivi d’une commande', async () => {
    const { result } = renderHook(() => useSuiviLivraison(7));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.suivi?.statut).toBe('En_cours');
    expect(recupererSuivi).toHaveBeenCalledWith(7);
  });

  it('n’émet aucune requête sans identifiant', () => {
    // Une commande dont on ne sait pas encore si elle existe ne doit pas
    // produire un 401 qui effacerait le jeton.
    const { result } = renderHook(() => useSuiviLivraison(null));

    expect(recupererSuivi).not.toHaveBeenCalled();
    expect(result.current.chargement).toBe(false);
  });

  it('traite le 404 comme « pas de livraison », pas comme une panne', async () => {
    vi.mocked(recupererSuivi).mockRejectedValue(erreurHttp(404));

    const { result } = renderHook(() => useSuiviLivraison(7));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.sansLivraison).toBe(true);
    expect(result.current.erreur).toBeNull();
  });

  it('signale les autres erreurs', async () => {
    vi.mocked(recupererSuivi).mockRejectedValue(erreurHttp(500));

    const { result } = renderHook(() => useSuiviLivraison(7));

    await waitFor(() => expect(result.current.erreur).not.toBeNull());
    expect(result.current.sansLivraison).toBe(false);
  });

  it('ne laisse pas fuir la trace technique', async () => {
    vi.mocked(recupererSuivi).mockRejectedValue(new Error('Request failed 500'));

    const { result } = renderHook(() => useSuiviLivraison(7));

    await waitFor(() => expect(result.current.erreur).not.toBeNull());
    expect(result.current.erreur).not.toContain('500');
  });

  it('recharge quand la commande change', async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useSuiviLivraison(id),
      { initialProps: { id: 7 } }
    );
    await waitFor(() => expect(result.current.chargement).toBe(false));

    rerender({ id: 12 });

    await waitFor(() => expect(recupererSuivi).toHaveBeenCalledWith(12));
  });
});

describe('useSuiviLivraisonInvitee', () => {
  it('charge par la référence publique', async () => {
    const reference = '8f14e45f-ceea-467a-9f5a-1f0a1f0a1f0a';

    const { result } = renderHook(() => useSuiviLivraisonInvitee(reference));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(recupererSuiviInvite).toHaveBeenCalledWith(reference);
  });

  it('n’émet aucune requête sans référence', () => {
    renderHook(() => useSuiviLivraisonInvitee(null));

    expect(recupererSuiviInvite).not.toHaveBeenCalled();
  });

  it('n’envoie jamais d’identifiant de commande', async () => {
    // La référence est la seule clé : un identifiant séquentiel serait
    // énumérable.
    const reference = '8f14e45f-ceea-467a-9f5a-1f0a1f0a1f0a';
    renderHook(() => useSuiviLivraisonInvitee(reference));

    await waitFor(() => expect(recupererSuiviInvite).toHaveBeenCalled());
    expect(vi.mocked(recupererSuiviInvite).mock.calls[0]).toEqual([reference]);
  });
});
