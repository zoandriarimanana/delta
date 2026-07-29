/**
 * Tests des hooks du module commande.
 *
 * Le panier étant un magasin externe persistant, chaque test repart d'un
 * `localStorage` vide et resynchronise le cache en mémoire — sans quoi l'état
 * d'un test fuiterait sur le suivant.
 */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { effacerJeton } from '@/lib/tokenStorage';

import { creerCommande, creerCommandeInvite } from './commande.api';
import { resynchroniserPanier } from './commande.panier';
import { usePanier, useValidationCommande } from './commande.hooks';
import type { Commande } from './commande.types';
import type { Produit } from '@/features/produit/produit.types';

vi.mock('./commande.api');

const PRODUIT: Produit = {
  id_produit: 1,
  nom: 'Éclair',
  description: null,
  prix_unitaire: '3.50',
  unite_mesure: 'piece',
  stock_disponible: 10,
  est_personnalisable: false,
  est_livrable: true,
  id_categorie: 1,
};

const COMMANDE: Commande = {
  id_commande: 7,
  date_commande: '2026-07-29T09:30:00+00:00',
  reference_publique: null,
  type_commande: 'En_ligne',
  statut: 'En_attente',
  montant_total: '7.00',
  id_client: 3,
  nom_invite: null,
  contact_invite: null,
  lignes: [],
};

beforeEach(() => {
  localStorage.clear();
  resynchroniserPanier();
  effacerJeton();
  vi.mocked(creerCommande).mockResolvedValue(COMMANDE);
  vi.mocked(creerCommandeInvite).mockResolvedValue({
    ...COMMANDE,
    id_client: null,
    reference_publique: '8f14e45f-ceea-467a-9f5a-1f0a1f0a1f0a',
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
  resynchroniserPanier();
});

describe('usePanier', () => {
  it('démarre vide', () => {
    const { result } = renderHook(() => usePanier());

    expect(result.current.lignes).toEqual([]);
    expect(result.current.nombre).toBe(0);
  });

  it('ajoute, modifie et retire', () => {
    const { result } = renderHook(() => usePanier());

    act(() => result.current.ajouter(PRODUIT, 2));
    expect(result.current.nombre).toBe(2);

    act(() => result.current.modifier(PRODUIT.id_produit, 5));
    expect(result.current.nombre).toBe(5);

    act(() => result.current.retirer(PRODUIT.id_produit));
    expect(result.current.lignes).toEqual([]);
  });

  it('survit à un rechargement de page', () => {
    const { result, unmount } = renderHook(() => usePanier());
    act(() => result.current.ajouter(PRODUIT, 3));
    unmount();

    // Simule un rechargement : le cache mémoire est reconstruit depuis le
    // stockage, comme au démarrage de l'application.
    resynchroniserPanier();
    const { result: apresRechargement } = renderHook(() => usePanier());

    expect(apresRechargement.current.nombre).toBe(3);
  });

  it('partage le même état entre deux consommateurs', () => {
    // C'est ce qui permet au compteur de la navigation et à la page panier de
    // ne jamais diverger, sans fournisseur enveloppant l'application.
    const premier = renderHook(() => usePanier());
    const second = renderHook(() => usePanier());

    act(() => premier.result.current.ajouter(PRODUIT, 2));

    expect(second.result.current.nombre).toBe(2);
  });

  it('ne casse pas sur un stockage corrompu', () => {
    localStorage.setItem('delta.panier', '{ ceci n’est pas du JSON');
    resynchroniserPanier();

    const { result } = renderHook(() => usePanier());

    expect(result.current.lignes).toEqual([]);
  });
});

describe('useValidationCommande', () => {
  it('appelle l’endpoint authentifié quand aucun invité n’est fourni', async () => {
    const { result } = renderHook(() => useValidationCommande());

    await act(async () => {
      await result.current.valider('En_ligne');
    });

    expect(creerCommande).toHaveBeenCalledWith({
      type_commande: 'En_ligne',
      lignes: [],
    });
    expect(creerCommandeInvite).not.toHaveBeenCalled();
  });

  it('appelle l’endpoint invité quand l’identité est fournie', async () => {
    const { result } = renderHook(() => useValidationCommande());

    await act(async () => {
      await result.current.valider('A_emporter', {
        nom_invite: 'Rakoto',
        contact_invite: '+261340000000',
      });
    });

    expect(creerCommandeInvite).toHaveBeenCalled();
    expect(creerCommande).not.toHaveBeenCalled();
  });

  it('vide le panier après un succès', async () => {
    const panier = renderHook(() => usePanier());
    act(() => panier.result.current.ajouter(PRODUIT, 2));
    const { result } = renderHook(() => useValidationCommande());

    await act(async () => {
      await result.current.valider('En_ligne');
    });

    expect(panier.result.current.lignes).toEqual([]);
  });

  it('conserve le panier après un échec', async () => {
    // Un échec réseau ou un stock devenu insuffisant ne doit jamais faire
    // perdre sa sélection au client.
    vi.mocked(creerCommande).mockRejectedValue(new Error('réseau'));
    const panier = renderHook(() => usePanier());
    act(() => panier.result.current.ajouter(PRODUIT, 2));
    const { result } = renderHook(() => useValidationCommande());

    await act(async () => {
      await result.current.valider('En_ligne');
    });

    expect(panier.result.current.nombre).toBe(2);
    await waitFor(() => expect(result.current.erreur).not.toBeNull());
  });

  it('reprend le message métier du serveur', async () => {
    // « Stock insuffisant » est une information utile, contrairement à une
    // trace technique.
    vi.mocked(creerCommande).mockRejectedValue({
      response: { data: { detail: 'Stock insuffisant pour « Éclair ».' } },
    });
    const { result } = renderHook(() => useValidationCommande());

    await act(async () => {
      await result.current.valider('En_ligne');
    });

    expect(result.current.erreur).toContain('Stock insuffisant');
  });

  it('retombe sur un message générique sans détail exploitable', async () => {
    vi.mocked(creerCommande).mockRejectedValue(new Error('Request failed 500'));
    const { result } = renderHook(() => useValidationCommande());

    await act(async () => {
      await result.current.valider('En_ligne');
    });

    expect(result.current.erreur).not.toContain('500');
  });

  it('retourne la commande créée, référence comprise', async () => {
    const { result } = renderHook(() => useValidationCommande());

    let commande: Commande | null = null;
    await act(async () => {
      commande = await result.current.valider('A_emporter', {
        nom_invite: 'Rakoto',
        contact_invite: '+261340000000',
      });
    });

    expect(commande!.reference_publique).not.toBeNull();
  });
});
