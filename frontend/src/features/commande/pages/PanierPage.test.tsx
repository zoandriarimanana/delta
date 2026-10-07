/** Tests de la page panier. */

import { act, cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { recupererPhotos } from '@/features/galerie/galerie.api';
import { recupererTarifLivraison } from '@/features/livraison/livraison.api';

import { ecrirePanier, lirePanier, resynchroniserPanier } from '../commande.panier';
import PanierPage from './PanierPage';

vi.mock('@/features/galerie/galerie.api', async (original) => ({
  ...(await original<typeof import('@/features/galerie/galerie.api')>()),
  recupererPhotos: vi.fn(),
}));
vi.mock('@/features/livraison/livraison.api', async (original) => ({
  ...(await original<typeof import('@/features/livraison/livraison.api')>()),
  recupererTarifLivraison: vi.fn(),
}));

function remplir(quantite = 2) {
  ecrirePanier([
    {
      id_produit: 1,
      nom: 'Éclair',
      prix_unitaire: '3.50',
      unite_mesure: 'piece',
      quantite,
      stock_disponible: 10,
    },
  ]);
}

function afficher() {
  return render(
    <MemoryRouter>
      <PanierPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  resynchroniserPanier();
  vi.mocked(recupererPhotos).mockResolvedValue([]);
  vi.mocked(recupererTarifLivraison).mockResolvedValue({
    forfait: '5000.00',
    seuil_gratuite: '100.00',
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  resynchroniserPanier();
});

it('annonce un panier vide plutôt qu’une page muette', () => {
  afficher();

  expect(screen.getByText(/panier est vide/i)).toBeDefined();
});

it('affiche les lignes et le total', () => {
  act(() => remplir());

  afficher();

  expect(screen.getByText('Éclair')).toBeDefined();
  const resume = within(screen.getByRole('complementary', { name: 'Récapitulatif' }));
  expect(resume.getByText('Sous-total (2 articles)')).toBeDefined();
  expect(resume.getAllByText(/7,00 Ar/).length).toBeGreaterThan(0);
});

it('situe le client dans les étapes de la commande', () => {
  act(() => remplir());
  afficher();

  const etapes = screen.getByRole('list', { name: 'Étapes de la commande' });
  expect(within(etapes).getByText('1').closest('[aria-current]')).not.toBeNull();
});

it('les boutons − et + modifient la quantité, bornés à 1 et au stock', async () => {
  act(() => remplir(1));
  afficher();

  expect(
    screen.getByRole('button', { name: 'Diminuer la quantité de Éclair' })
  ).toHaveProperty('disabled', true);
  await userEvent.click(
    screen.getByRole('button', { name: 'Augmenter la quantité de Éclair' })
  );

  expect(lirePanier()[0]?.quantite).toBe(2);
});

it('montre la progression vers la livraison offerte', async () => {
  act(() => remplir());
  afficher();

  expect(
    await screen.findByText(/Plus que 93,00 Ar pour la livraison offerte/)
  ).toBeDefined();
  expect(
    screen.getByRole('progressbar', { name: 'Progression vers la livraison offerte' })
  ).toHaveProperty('ariaValueNow', '7');
});

it('propose de découvrir le catalogue quand le panier est vide', () => {
  afficher();

  expect(
    screen.getByRole('link', { name: /Découvrir nos produits/ }).getAttribute('href')
  ).toBe('/produits');
});

it('annonce que le total est indicatif', () => {
  // Le montant facturé est celui que le serveur recalcule : le dire évite une
  // surprise si un tarif a changé entre-temps.
  act(() => remplir());

  afficher();

  expect(screen.getByText(/indicatif/i)).toBeDefined();
});

it('modifie la quantité', async () => {
  act(() => remplir());
  afficher();

  const champ = screen.getByLabelText(/quantité pour Éclair/i);
  await userEvent.clear(champ);
  await userEvent.type(champ, '5');

  expect(lirePanier()[0]?.quantite).toBe(5);
});

it('ne perd pas la ligne quand on vide le champ pour retaper', async () => {
  // `userEvent.clear` émet une valeur vide. Sans garde, elle serait lue comme
  // une quantité nulle et la ligne disparaîtrait sous les doigts du client.
  act(() => remplir(2));
  afficher();

  await userEvent.clear(screen.getByLabelText(/quantité pour Éclair/i));

  expect(lirePanier()).toHaveLength(1);
  expect(lirePanier()[0]?.quantite).toBe(2);
});

it('retire une ligne', async () => {
  act(() => remplir());
  afficher();

  await userEvent.click(screen.getByRole('button', { name: /retirer/i }));

  expect(lirePanier()).toEqual([]);
  expect(screen.getByText(/panier est vide/i)).toBeDefined();
});

it('vide le panier', async () => {
  act(() => remplir());
  afficher();

  await userEvent.click(screen.getByRole('button', { name: /vider/i }));

  expect(lirePanier()).toEqual([]);
});
