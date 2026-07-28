/** Tests de la fiche produit. */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { recupererCategories, recupererProduit } from '../produit.api';
import type { Produit } from '../produit.types';
import ProduitDetailPage from './ProduitDetailPage';

vi.mock('../produit.api');

const PRODUIT: Produit = {
  id_produit: 1,
  nom: 'Éclair au chocolat',
  description: 'Pâte à choux, crème pâtissière.',
  prix_unitaire: '3.50',
  unite_mesure: 'piece',
  stock_disponible: 0,
  est_personnalisable: true,
  est_livrable: true,
  id_categorie: 1,
};

function afficher(chemin: string) {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/produits/:idProduit" element={<ProduitDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(recupererProduit).mockResolvedValue(PRODUIT);
  vi.mocked(recupererCategories).mockResolvedValue([
    { id_categorie: 1, libelle: 'Pâtisserie' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('affiche la fiche du produit demandé', async () => {
  afficher('/produits/1');

  expect(await screen.findByRole('heading', { name: PRODUIT.nom })).toBeDefined();
  expect(recupererProduit).toHaveBeenCalledWith(1);
  expect(screen.getByText(PRODUIT.description!)).toBeDefined();
});

it('résout le libellé de la catégorie', async () => {
  afficher('/produits/1');

  expect(await screen.findByText('Pâtisserie')).toBeDefined();
});

it('annonce un produit épuisé', async () => {
  afficher('/produits/1');

  expect(await screen.findByText('Épuisé')).toBeDefined();
});

it('affiche un message d’erreur plutôt qu’une page blanche', async () => {
  vi.mocked(recupererProduit).mockRejectedValue(new Error('404'));

  afficher('/produits/1');

  expect(await screen.findByRole('alert')).toBeDefined();
});

it('refuse un identifiant non numérique sans appeler l’API', async () => {
  // `Number('abc')` vaut NaN : laissé passer, il partirait tel quel dans l'URL
  // appelée et produirait une erreur serveur illisible.
  afficher('/produits/abc');

  expect(
    await screen.findByRole('heading', { name: 'Produit introuvable' })
  ).toBeDefined();
  expect(recupererProduit).not.toHaveBeenCalled();
});

it('propose toujours un retour au catalogue', async () => {
  afficher('/produits/abc');

  const lien = await screen.findByRole('link', { name: /retour au catalogue/i });
  expect(lien.getAttribute('href')).toBe('/produits');
});
