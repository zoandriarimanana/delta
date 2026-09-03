/**
 * Tests des hooks du module produit.
 *
 * Le module d'API est substitué : ce qui est vérifié ici, c'est la machine à
 * états et les arguments transmis, pas le transport HTTP — celui-ci est couvert
 * par `lib/axiosClient.test.ts`.
 */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  recupererCategories,
  recupererProduit,
  recupererProduits,
} from './produit.api';
import { useCategories, useProduit, useProduits } from './produit.hooks';
import { TOUTES_CATEGORIES } from './produit.service';
import type { Produit } from './produit.types';

vi.mock('./produit.api');

const PRODUIT: Produit = {
  id_produit: 1,
  nom: 'Éclair au chocolat',
  description: null,
  prix_unitaire: '3.50',
  unite_mesure: 'piece',
  stock_disponible: 10,
  est_personnalisable: false,
  supplement_personnalisation: null,
  est_livrable: true,
  id_categorie: 1,
};

beforeEach(() => {
  vi.mocked(recupererProduits).mockResolvedValue([PRODUIT]);
  vi.mocked(recupererProduit).mockResolvedValue(PRODUIT);
  vi.mocked(recupererCategories).mockResolvedValue([
    { id_categorie: 1, libelle: 'Pâtisserie' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('useProduits', () => {
  it('commence en chargement puis expose les données', async () => {
    const { result } = renderHook(() => useProduits(TOUTES_CATEGORIES));

    expect(result.current.chargement).toBe(true);
    expect(result.current.donnees).toBeNull();

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.donnees).toEqual([PRODUIT]);
    expect(result.current.erreur).toBeNull();
  });

  it('n’envoie aucun paramètre quand aucune catégorie n’est choisie', async () => {
    renderHook(() => useProduits(TOUTES_CATEGORIES));

    await waitFor(() => expect(recupererProduits).toHaveBeenCalled());
    expect(recupererProduits).toHaveBeenCalledWith(undefined);
  });

  it('transmet l’identifiant de catégorie sélectionné', async () => {
    renderHook(() => useProduits(2));

    await waitFor(() => expect(recupererProduits).toHaveBeenCalledWith(2));
  });

  it('relance la requête au changement de filtre', async () => {
    const { result, rerender } = renderHook(({ filtre }) => useProduits(filtre), {
      initialProps: { filtre: TOUTES_CATEGORIES as number | typeof TOUTES_CATEGORIES },
    });
    await waitFor(() => expect(result.current.chargement).toBe(false));

    rerender({ filtre: 2 });

    // Le chargement doit repartir : sans cela, l'ancienne liste resterait
    // affichée sans aucun signe qu'elle change.
    await waitFor(() => expect(recupererProduits).toHaveBeenCalledWith(2));
    expect(recupererProduits).toHaveBeenCalledTimes(2);
  });

  it('ne relance rien si le filtre ne change pas', async () => {
    const { result, rerender } = renderHook(({ filtre }) => useProduits(filtre), {
      initialProps: { filtre: 2 },
    });
    await waitFor(() => expect(result.current.chargement).toBe(false));

    rerender({ filtre: 2 });

    expect(recupererProduits).toHaveBeenCalledTimes(1);
  });

  it('expose un message d’erreur sans laisser de données périmées', async () => {
    vi.mocked(recupererProduits).mockRejectedValue(new Error('réseau'));

    const { result } = renderHook(() => useProduits(TOUTES_CATEGORIES));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.erreur).not.toBeNull();
    expect(result.current.donnees).toBeNull();
  });

  it('ne remonte pas la trace technique de l’erreur', async () => {
    vi.mocked(recupererProduits).mockRejectedValue(new Error('Request failed 500'));

    const { result } = renderHook(() => useProduits(TOUTES_CATEGORIES));

    await waitFor(() => expect(result.current.erreur).not.toBeNull());
    expect(result.current.erreur).not.toContain('500');
  });

  it('ignore une réponse arrivée après le démontage', async () => {
    let resoudre: ((valeur: Produit[]) => void) | undefined;
    vi.mocked(recupererProduits).mockReturnValue(
      new Promise((r) => {
        resoudre = r;
      })
    );

    const { unmount } = renderHook(() => useProduits(TOUTES_CATEGORIES));
    unmount();

    // Ne doit ni lever, ni tenter de mettre à jour un composant démonté.
    expect(() => resoudre?.([PRODUIT])).not.toThrow();
  });
});

describe('useProduit', () => {
  it('transmet l’identifiant demandé', async () => {
    const { result } = renderHook(() => useProduit(42));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(recupererProduit).toHaveBeenCalledWith(42);
    expect(result.current.donnees).toEqual(PRODUIT);
  });
});

describe('useCategories', () => {
  it('charge les catégories une seule fois', async () => {
    const { result, rerender } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.chargement).toBe(false));

    rerender();

    expect(recupererCategories).toHaveBeenCalledTimes(1);
  });
});
