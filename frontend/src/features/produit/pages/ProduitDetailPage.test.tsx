/** Tests de la fiche produit. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { lirePanier, viderPanier } from '@/features/commande/commande.panier';

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
  supplement_personnalisation: null,
  est_livrable: true,
  id_categorie: 1,
  note_moyenne: '4.5000000000000000',
  nombre_avis: 8,
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
  viderPanier();
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

it('annonce un produit épuisé et retire le bloc d’achat', async () => {
  afficher('/produits/1');

  expect((await screen.findAllByText('Épuisé')).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: /ajouter au panier/i })).toBeNull();
});

it('affiche les statuts du produit en pastilles', async () => {
  afficher('/produits/1');

  const statuts = await screen.findByRole('list', { name: 'Statuts du produit' });
  expect(statuts.textContent).toContain('Épuisé');
  expect(statuts.textContent).toContain('Livrable');
  expect(statuts.textContent).toContain('Personnalisable');
});

it('affiche une illustration en grand format', async () => {
  const { container } = afficher('/produits/1');

  await screen.findByRole('heading', { name: PRODUIT.nom });
  expect(container.querySelector('img')?.getAttribute('src')).toContain('w=900');
});

it('annonce une description absente plutôt que de laisser un vide', async () => {
  vi.mocked(recupererProduit).mockResolvedValue({ ...PRODUIT, description: null });
  afficher('/produits/1');

  expect(await screen.findByText('Aucune description pour ce produit.')).toBeDefined();
});

it('ajoute la quantité choisie au panier, bornée au stock', async () => {
  vi.mocked(recupererProduit).mockResolvedValue({ ...PRODUIT, stock_disponible: 2 });
  afficher('/produits/1');

  const plus = await screen.findByRole('button', { name: 'Augmenter la quantité' });
  fireEvent.click(plus);
  expect(plus.hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /ajouter au panier/i }));

  expect(lirePanier()).toMatchObject([{ id_produit: 1, quantite: 2 }]);
  expect(screen.getByRole('status').textContent).toContain('Ajouté au panier');
  expect(
    screen.getByRole('link', { name: 'Voir le panier' }).getAttribute('href')
  ).toBe('/panier');
});

it('affiche la note moyenne calculée sur la fiche', async () => {
  afficher('/produits/1');

  expect(await screen.findByText('4.5 sur 5 · 8 avis')).toBeDefined();
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
