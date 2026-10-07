/** Tests des frais de livraison affichés sur la fiche produit. */

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { recupererTarifLivraison } from '@/features/livraison/livraison.api';

import type { Produit } from '../produit.types';
import ComparaisonLivraison from './ComparaisonLivraison';

vi.mock('@/features/livraison/livraison.api');

const GATEAU: Produit = {
  id_produit: 3,
  nom: 'Gâteau d’anniversaire',
  description: null,
  prix_unitaire: '25000.00',
  unite_mesure: 'piece',
  stock_disponible: 8,
  est_personnalisable: false,
  supplement_personnalisation: null,
  est_livrable: true,
  id_categorie: 1,
  note_moyenne: null,
  nombre_avis: 0,
};

beforeEach(() => {
  vi.mocked(recupererTarifLivraison).mockResolvedValue({
    forfait: '5000.00',
    seuil_gratuite: '100000.00',
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function bloc() {
  return within(screen.getByRole('group', { name: 'Frais de livraison' }));
}

it('affiche les frais de livraison et le total livré', async () => {
  render(<ComparaisonLivraison produit={GATEAU} quantite={1} />);

  expect(await bloc().findByText(/^5\s000,00 Ar$/)).toBeDefined();
  expect(bloc().getByText('Frais de livraison')).toBeDefined();
  expect(bloc().getByText(/^30\s000,00 Ar$/)).toBeDefined();
  expect(bloc().getByText(/offerte dès 100\s000,00 Ar/)).toBeDefined();
  expect(bloc().queryByText(/Retrait sur place/)).toBeNull();
});

it('suit la quantité choisie et annonce la livraison offerte au seuil', async () => {
  render(<ComparaisonLivraison produit={GATEAU} quantite={4} />);

  expect(await bloc().findByText('Offerte')).toBeDefined();
  expect(bloc().getByText(/^100\s000,00 Ar$/)).toBeDefined();
  expect(bloc().getByText(/4 × 25\s000,00 Ar \+ livraison/)).toBeDefined();
});

it('n’annonce aucun frais pour un produit non livrable', () => {
  render(
    <ComparaisonLivraison produit={{ ...GATEAU, est_livrable: false }} quantite={1} />
  );

  expect(bloc().getByText(/retrait sur place uniquement/)).toBeDefined();
  expect(bloc().queryByText(/Total avec livraison/)).toBeNull();
});

it('tait le montant si le tarif ne peut pas être lu', async () => {
  vi.mocked(recupererTarifLivraison).mockRejectedValue(new Error('réseau'));
  render(<ComparaisonLivraison produit={GATEAU} quantite={1} />);

  expect(await bloc().findByText(/Affichés au moment de commander/)).toBeDefined();
});

it('compte le supplément de personnalisation dans le total livré', async () => {
  render(
    <ComparaisonLivraison produit={GATEAU} quantite={2} supplementUnitaire={5000} />
  );

  // 2 × (25 000 + 5 000) = 60 000 de produits + 5 000 de livraison.
  expect(await bloc().findByText(/^65\s000,00 Ar$/)).toBeDefined();
  expect(bloc().getByText(/de personnalisation\) \+ livraison/)).toBeDefined();
});
