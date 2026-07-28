/** Tests de la page panier. */

import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { ecrirePanier, lirePanier, resynchroniserPanier } from '../commande.panier';
import PanierPage from './PanierPage';

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
  expect(screen.getByText(/7,00 Ar/)).toBeDefined();
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
