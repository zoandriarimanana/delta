/**
 * Tests du layout — et notamment de son compteur de panier.
 *
 * L'enjeu n'est pas l'affichage mais la provenance de la donnée : elle vient
 * d'un hook exposé par `features/commande/`, jamais d'une logique écrite dans
 * `layouts/` (cf. `docs/architecture.md`).
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it } from 'vitest';

import {
  ecrirePanier,
  resynchroniserPanier,
} from '@/features/commande/commande.panier';
import { effacerJeton, enregistrerSession } from '@/lib/tokenStorage';

import MainLayout from './MainLayout';

function afficher() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<p>contenu</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function remplir(quantite: number) {
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

beforeEach(() => {
  localStorage.clear();
  effacerJeton();
  resynchroniserPanier();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  resynchroniserPanier();
});

it('n’affiche aucun compteur quand le panier est vide', () => {
  afficher();

  expect(screen.queryByTestId('compteur-panier')).toBeNull();
});

it('affiche le nombre d’articles du panier', () => {
  act(() => remplir(3));

  afficher();

  expect(screen.getByTestId('compteur-panier').textContent).toBe('3');
});

it('suit les changements du panier sans être remonté', () => {
  // C'est ce que garantit le magasin externe : le compteur et la page panier
  // ne peuvent pas diverger.
  afficher();

  act(() => remplir(2));

  expect(screen.getByTestId('compteur-panier').textContent).toBe('2');
});

it('porte la navigation transverse', () => {
  afficher();

  for (const libelle of ['Accueil', 'Catalogue', 'Panier', 'Connexion']) {
    expect(screen.getByRole('link', { name: new RegExp(libelle) })).toBeDefined();
  }
});

it('offre « Connexion » au visiteur, jamais « Déconnexion »', () => {
  afficher();

  expect(screen.getByRole('link', { name: /connexion/i })).toBeDefined();
  expect(screen.queryByRole('button', { name: /déconnexion/i })).toBeNull();
});

it('offre la déconnexion au client connecté', () => {
  // Sans elle, un client ne pourrait pas fermer sa session autrement qu'en
  // vidant le stockage du navigateur.
  enregistrerSession('jeton', 'client');

  afficher();

  expect(screen.getByRole('button', { name: /déconnexion/i })).toBeDefined();
  expect(screen.queryByRole('link', { name: /^connexion$/i })).toBeNull();
});

it('offre la déconnexion au personnel connecté', () => {
  enregistrerSession('jeton', 'personnel');

  afficher();

  expect(screen.getByRole('button', { name: /déconnexion/i })).toBeDefined();
});

it('ne propose les pages client qu’au client', () => {
  // Un salarié qui ouvrirait « Mes commandes » recevrait un 401, ce qui
  // effacerait sa session de travail.
  enregistrerSession('jeton', 'personnel');

  afficher();

  expect(screen.queryByRole('link', { name: /mes commandes/i })).toBeNull();
  expect(screen.queryByRole('link', { name: /mes réservations/i })).toBeNull();
});
