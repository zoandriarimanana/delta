/** Tests du prix en retrait et du prix livré sur la fiche produit. */

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
  return within(screen.getByRole('group', { name: 'Prix selon le mode de réception' }));
}

it('montre le prix en retrait et le prix avec livraison', async () => {
  render(<ComparaisonLivraison produit={GATEAU} quantite={1} />);

  expect(await bloc().findByText(/30\s000,00 Ar/)).toBeDefined();
  expect(bloc().getByText(/25\s000,00 Ar/)).toBeDefined();
  expect(bloc().getByText(/dont 5\s000,00 Ar de livraison/)).toBeDefined();
  expect(bloc().getByText(/offerte dès 100\s000,00 Ar/)).toBeDefined();
});

it('suit la quantité choisie et annonce la livraison offerte au seuil', async () => {
  render(<ComparaisonLivraison produit={GATEAU} quantite={4} />);

  expect(await bloc().findByText('Livraison offerte')).toBeDefined();
  expect(bloc().getAllByText(/100\s000,00 Ar/).length).toBeGreaterThan(0);
  expect(bloc().getByText(/4 × 25\s000,00 Ar/)).toBeDefined();
});

it('n’annonce aucune livraison pour un produit non livrable', () => {
  render(
    <ComparaisonLivraison produit={{ ...GATEAU, est_livrable: false }} quantite={1} />
  );

  expect(bloc().getByText(/retire sur place uniquement/)).toBeDefined();
  expect(bloc().queryByText(/Avec livraison/)).toBeNull();
});

it('tait le montant si le tarif ne peut pas être lu', async () => {
  vi.mocked(recupererTarifLivraison).mockRejectedValue(new Error('réseau'));
  render(<ComparaisonLivraison produit={GATEAU} quantite={1} />);

  expect(
    await bloc().findByText(/les frais s’affichent au moment de commander/)
  ).toBeDefined();
});
