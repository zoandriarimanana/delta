/**
 * Tests des hooks d'administration du module commande (Sprint 10.6).
 *
 * Le module d'API est substitué : ce qui est vérifié ici, c'est
 * l'orchestration des appels et l'état exposé, pas le transport HTTP.
 */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  annulerCommandeAdministration,
  obtenirCommandeAdministration,
  recupererCommandesAdministration,
  rembourserCommandeAdministration,
} from './commande.api';
import {
  messageDAdministration,
  useActionRelanceLivraison,
  useActionsCommandeAdministration,
  useCommandeDetailAdministration,
  useCommandesAdministration,
  useLivraisonEchoueeDeLaCommande,
} from './commande.administration';
import type { Commande } from './commande.types';
import {
  recupererLivraisonsAdministration,
  relancerLivraison,
} from '@/features/livraison/livraison.api';
import type { LivraisonAdministration } from '@/features/livraison/livraison.types';

vi.mock('./commande.api');
vi.mock('@/features/livraison/livraison.api');

const COMMANDE: Commande = {
  id_commande: 7,
  date_commande: '2026-07-29T09:30:00+00:00',
  reference_publique: null,
  type_commande: 'En_ligne',
  statut: 'En_attente',
  montant_total: '7000.00',
  id_client: 3,
  nom_invite: null,
  contact_invite: null,
  lignes: [],
  rembourse_le: null,
};

const LIVRAISON_ECHOUEE: LivraisonAdministration = {
  id_livraison: 12,
  id_commande: 7,
  statut: 'Echouee',
  date_heure_prevue: null,
  date_heure_reelle: null,
  id_personnel: 4,
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('useCommandesAdministration', () => {
  it('charge toutes les commandes', async () => {
    vi.mocked(recupererCommandesAdministration).mockResolvedValue([COMMANDE]);

    const { result } = renderHook(() => useCommandesAdministration());

    expect(result.current.chargement).toBe(true);
    await waitFor(() => expect(result.current.chargement).toBe(false));

    expect(result.current.commandes).toEqual([COMMANDE]);
  });

  it('recharge sur demande', async () => {
    vi.mocked(recupererCommandesAdministration).mockResolvedValue([COMMANDE]);
    const { result } = renderHook(() => useCommandesAdministration());
    await waitFor(() => expect(result.current.chargement).toBe(false));

    act(() => result.current.recharger());

    await waitFor(() =>
      expect(recupererCommandesAdministration).toHaveBeenCalledTimes(2)
    );
  });

  it('remonte un refus 403 comme un message dédié', async () => {
    vi.mocked(recupererCommandesAdministration).mockRejectedValue({
      response: { status: 403 },
    });

    const { result } = renderHook(() => useCommandesAdministration());

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.erreur).toBe(
      'Cette action est réservée aux administrateurs.'
    );
  });
});

describe('useCommandeDetailAdministration', () => {
  it('charge la commande désignée', async () => {
    vi.mocked(obtenirCommandeAdministration).mockResolvedValue(COMMANDE);

    const { result } = renderHook(() => useCommandeDetailAdministration(7));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.commande).toEqual(COMMANDE);
    expect(obtenirCommandeAdministration).toHaveBeenCalledWith(7);
  });

  it('recharge sur demande', async () => {
    vi.mocked(obtenirCommandeAdministration).mockResolvedValue(COMMANDE);
    const { result } = renderHook(() => useCommandeDetailAdministration(7));
    await waitFor(() => expect(result.current.chargement).toBe(false));

    act(() => result.current.recharger());

    await waitFor(() => expect(obtenirCommandeAdministration).toHaveBeenCalledTimes(2));
  });
});

describe('useActionsCommandeAdministration', () => {
  it('annuler appelle l’API puis recharge', async () => {
    vi.mocked(annulerCommandeAdministration).mockResolvedValue({
      ...COMMANDE,
      statut: 'Annulee',
    });
    const recharger = vi.fn();
    const { result } = renderHook(() => useActionsCommandeAdministration(7, recharger));

    let ok = false;
    await act(async () => {
      ok = await result.current.annuler();
    });

    expect(ok).toBe(true);
    expect(annulerCommandeAdministration).toHaveBeenCalledWith(7);
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('rembourser appelle l’API puis recharge', async () => {
    vi.mocked(rembourserCommandeAdministration).mockResolvedValue({
      ...COMMANDE,
      rembourse_le: '2026-09-08T10:00:00+00:00',
    });
    const recharger = vi.fn();
    const { result } = renderHook(() => useActionsCommandeAdministration(7, recharger));

    await act(async () => {
      await result.current.rembourser();
    });

    expect(rembourserCommandeAdministration).toHaveBeenCalledWith(7);
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('reprend le message 409 tel quel, sans recharger', async () => {
    vi.mocked(annulerCommandeAdministration).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Cette commande est déjà annulée.' },
      },
    });
    const recharger = vi.fn();
    const { result } = renderHook(() => useActionsCommandeAdministration(7, recharger));

    let ok = true;
    await act(async () => {
      ok = await result.current.annuler();
    });

    expect(ok).toBe(false);
    expect(result.current.erreur).toBe('Cette commande est déjà annulée.');
    expect(recharger).not.toHaveBeenCalled();
  });
});

describe('useLivraisonEchoueeDeLaCommande', () => {
  it('trouve la livraison échouée correspondant à la commande', async () => {
    vi.mocked(recupererLivraisonsAdministration).mockResolvedValue([
      LIVRAISON_ECHOUEE,
      { ...LIVRAISON_ECHOUEE, id_livraison: 99, id_commande: 999 },
    ]);

    const { result } = renderHook(() => useLivraisonEchoueeDeLaCommande(7));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.livraison).toEqual(LIVRAISON_ECHOUEE);
    expect(recupererLivraisonsAdministration).toHaveBeenCalledWith('Echouee');
  });

  it('rend null si aucune livraison échouée ne correspond', async () => {
    vi.mocked(recupererLivraisonsAdministration).mockResolvedValue([]);

    const { result } = renderHook(() => useLivraisonEchoueeDeLaCommande(7));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.livraison).toBeNull();
  });
});

describe('useActionRelanceLivraison', () => {
  it('relance puis recharge', async () => {
    vi.mocked(relancerLivraison).mockResolvedValue({
      ...LIVRAISON_ECHOUEE,
      statut: 'En_attente',
      id_personnel: null,
    });
    const recharger = vi.fn();
    const { result } = renderHook(() => useActionRelanceLivraison(recharger));

    let ok = false;
    await act(async () => {
      ok = await result.current.relancer(12);
    });

    expect(ok).toBe(true);
    expect(relancerLivraison).toHaveBeenCalledWith(12);
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('reprend le message 409 tel quel', async () => {
    vi.mocked(relancerLivraison).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Cette livraison n’est pas « Echouee ».' },
      },
    });
    const recharger = vi.fn();
    const { result } = renderHook(() => useActionRelanceLivraison(recharger));

    let ok = true;
    await act(async () => {
      ok = await result.current.relancer(12);
    });

    expect(ok).toBe(false);
    expect(result.current.erreur).toBe('Cette livraison n’est pas « Echouee ».');
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
