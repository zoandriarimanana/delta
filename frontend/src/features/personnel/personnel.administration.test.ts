/**
 * Tests des hooks d'administration du module personnel.
 *
 * Le module d'API est substitué : ce qui est vérifié ici, c'est
 * l'orchestration des appels et l'état exposé, pas le transport HTTP —
 * couvert par `lib/axiosClient.test.ts`.
 */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { creerPersonnel, listerPersonnel, obtenirPersonnel } from './personnel.api';
import {
  messageDAdministration,
  useAnnuairePersonnel,
  useCreerPersonnel,
  usePersonnelDetailAdministration,
} from './personnel.administration';
import type { Personnel } from './personnel.types';

vi.mock('./personnel.api');

const RAKOTO: Personnel = {
  id_personnel: 1,
  nom: 'Rakoto',
  prenom: 'Jean',
  fonction: 'Livreur',
  email: 'jean.rakoto@delta.mg',
  telephone: null,
  date_embauche: null,
  specialite: null,
  zone_livraison: null,
  est_administrateur: false,
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('useAnnuairePersonnel', () => {
  it('charge le personnel actif', async () => {
    vi.mocked(listerPersonnel).mockResolvedValue([RAKOTO]);

    const { result } = renderHook(() => useAnnuairePersonnel(''));

    expect(result.current.chargement).toBe(true);
    await waitFor(() => expect(result.current.chargement).toBe(false));

    expect(result.current.personnels).toEqual([RAKOTO]);
    expect(listerPersonnel).toHaveBeenCalledWith(undefined);
  });

  it('passe la fonction choisie au filtre serveur', async () => {
    vi.mocked(listerPersonnel).mockResolvedValue([]);

    renderHook(() => useAnnuairePersonnel('Livreur'));

    await waitFor(() => expect(listerPersonnel).toHaveBeenCalledWith('Livreur'));
  });

  it('recharge sur demande', async () => {
    vi.mocked(listerPersonnel).mockResolvedValue([RAKOTO]);
    const { result } = renderHook(() => useAnnuairePersonnel(''));
    await waitFor(() => expect(result.current.chargement).toBe(false));

    act(() => result.current.recharger());

    await waitFor(() => expect(listerPersonnel).toHaveBeenCalledTimes(2));
  });

  it('remonte le message de l’API en cas d’échec', async () => {
    vi.mocked(listerPersonnel).mockRejectedValue({
      response: { status: 403 },
    });

    const { result } = renderHook(() => useAnnuairePersonnel(''));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.erreur).toBe(
      'Cette action est réservée aux administrateurs.'
    );
  });
});

describe('usePersonnelDetailAdministration', () => {
  it('charge un membre par son identifiant', async () => {
    vi.mocked(obtenirPersonnel).mockResolvedValue(RAKOTO);

    const { result } = renderHook(() => usePersonnelDetailAdministration(1));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.personnel).toEqual(RAKOTO);
  });

  it('remonte 404 comme un message exploitable', async () => {
    vi.mocked(obtenirPersonnel).mockRejectedValue({
      response: { status: 404, data: { detail: 'Membre du personnel introuvable.' } },
    });

    const { result } = renderHook(() => usePersonnelDetailAdministration(999));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.erreur).toBe('Membre du personnel introuvable.');
    expect(result.current.personnel).toBeNull();
  });
});

describe('useCreerPersonnel', () => {
  it('crée un membre et appelle surSucces', async () => {
    vi.mocked(creerPersonnel).mockResolvedValue(RAKOTO);
    const surSucces = vi.fn();
    const { result } = renderHook(() => useCreerPersonnel(surSucces));

    let cree: Personnel | null = null;
    await act(async () => {
      cree = await result.current.creerUnMembre({
        nom: 'Rakoto',
        prenom: 'Jean',
        fonction: 'Livreur',
        email: 'jean.rakoto@delta.mg',
      });
    });

    expect(cree).toEqual(RAKOTO);
    expect(surSucces).toHaveBeenCalledTimes(1);
  });

  it('remonte le refus 409 sans appeler surSucces', async () => {
    vi.mocked(creerPersonnel).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Un membre du personnel actif utilise déjà cette adresse.' },
      },
    });
    const surSucces = vi.fn();
    const { result } = renderHook(() => useCreerPersonnel(surSucces));

    let cree: Personnel | null = RAKOTO;
    await act(async () => {
      cree = await result.current.creerUnMembre({
        nom: 'Rakoto',
        prenom: 'Jean',
        fonction: 'Livreur',
        email: 'jean.rakoto@delta.mg',
      });
    });

    expect(cree).toBeNull();
    expect(result.current.erreur).toBe(
      'Un membre du personnel actif utilise déjà cette adresse.'
    );
    expect(surSucces).not.toHaveBeenCalled();
  });
});

describe('messageDAdministration', () => {
  it('retombe sur un message dédié pour un refus 403', () => {
    expect(messageDAdministration({ response: { status: 403 } })).toBe(
      'Cette action est réservée aux administrateurs.'
    );
  });

  it('reprend le detail du serveur quand il est une chaîne', () => {
    const erreur = {
      response: { status: 409, data: { detail: 'Adresse déjà prise.' } },
    };

    expect(messageDAdministration(erreur)).toBe('Adresse déjà prise.');
  });

  it('retombe sur un message générique sans detail exploitable', () => {
    expect(messageDAdministration(new Error('boom'))).toBe(
      'L’opération a échoué. Réessayez dans un instant.'
    );
  });
});
