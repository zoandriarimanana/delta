/**
 * Tests de la page catalogue.
 *
 * Le module d'API est substitué ; c'est le comportement de la page qui est
 * vérifié — états de chargement et d'erreur, filtre, liens vers les fiches.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recupererCategories, recupererProduits } from '../produit.api';
import type { Produit } from '../produit.types';
import ProduitListPage from './ProduitListPage';

vi.mock('../produit.api');

function produit(surcharge: Partial<Produit> = {}): Produit {
  return {
    id_produit: 1,
    nom: 'Éclair au chocolat',
    description: null,
    prix_unitaire: '3.50',
    unite_mesure: 'piece',
    stock_disponible: 10,
    est_personnalisable: false,
    est_livrable: true,
    id_categorie: 1,
    ...surcharge,
  };
}

function afficher() {
  return render(
    <MemoryRouter>
      <ProduitListPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(recupererProduits).mockResolvedValue([produit()]);
  vi.mocked(recupererCategories).mockResolvedValue([
    { id_categorie: 1, libelle: 'Pâtisserie' },
    { id_categorie: 2, libelle: 'Confiture' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('affiche un état de chargement avant les données', () => {
  afficher();

  expect(screen.getByRole('status')).toBeDefined();
});

it('affiche les produits une fois chargés', async () => {
  afficher();

  expect(await screen.findByText('Éclair au chocolat')).toBeDefined();
});

it('relie chaque produit à sa fiche', async () => {
  afficher();

  const lien = await screen.findByRole('link', { name: 'Éclair au chocolat' });
  expect(lien.getAttribute('href')).toBe('/produits/1');
});

describe('erreurs', () => {
  it('affiche un message et jamais une page blanche', async () => {
    vi.mocked(recupererProduits).mockRejectedValue(new Error('réseau'));

    afficher();

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).toBeTruthy();
  });

  it('laisse le catalogue lisible si seules les catégories échouent', async () => {
    // L'échec du filtre ne doit pas emporter la liste : ce sont deux requêtes
    // indépendantes.
    vi.mocked(recupererCategories).mockRejectedValue(new Error('réseau'));

    afficher();

    expect(await screen.findByText('Éclair au chocolat')).toBeDefined();
    expect(screen.queryByLabelText('Catégorie')).toBeNull();
  });
});

describe('filtre par catégorie', () => {
  it('recharge la liste avec la catégorie choisie', async () => {
    afficher();
    await screen.findByText('Éclair au chocolat');

    await userEvent.selectOptions(await screen.findByLabelText('Catégorie'), '2');

    await waitFor(() => expect(recupererProduits).toHaveBeenCalledWith(2));
  });

  it('annonce une catégorie vide au lieu d’une liste muette', async () => {
    vi.mocked(recupererProduits).mockResolvedValue([]);

    afficher();

    expect(await screen.findByText(/aucun produit/i)).toBeDefined();
  });
});
