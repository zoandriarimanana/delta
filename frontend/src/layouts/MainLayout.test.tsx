/**
 * Tests du layout — et notamment de son compteur de panier.
 *
 * L'enjeu n'est pas l'affichage mais la provenance de la donnée : elle vient
 * d'un hook exposé par `features/commande/`, jamais d'une logique écrite dans
 * `layouts/` (cf. `docs/architecture.md`).
 */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import {
  ecrirePanier,
  resynchroniserPanier,
} from '@/features/commande/commande.panier';
import { definirSession, effacerSession, lireSession } from '@/lib/session.store';

import MainLayout from './MainLayout';

const { deconnecter } = vi.hoisted(() => ({ deconnecter: vi.fn() }));
vi.mock('@/features/auth/auth.api', () => ({ deconnecter }));

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
  effacerSession();
  resynchroniserPanier();
  deconnecter.mockReset();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  effacerSession();
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

  for (const libelle of ['Accueil', 'Produits', 'Panier', 'Connexion']) {
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
  definirSession('client');

  afficher();

  expect(screen.getByRole('button', { name: /déconnexion/i })).toBeDefined();
  expect(screen.queryByRole('link', { name: /^connexion$/i })).toBeNull();
});

it('offre la déconnexion au personnel connecté', () => {
  definirSession('personnel');

  afficher();

  expect(screen.getByRole('button', { name: /déconnexion/i })).toBeDefined();
});

it('ne propose les pages client qu’au client', () => {
  // Un salarié qui ouvrirait « Mes commandes » recevrait un 401, ce qui
  // effacerait sa session de travail.
  definirSession('personnel');

  afficher();

  expect(screen.queryByRole('link', { name: /mes commandes/i })).toBeNull();
  expect(screen.queryByRole('link', { name: /mes réservations/i })).toBeNull();
});

const LIBELLES_PERSONNEL_OBSOLETES = [
  'Personnel',
  'Réservations',
  'Commandes',
  'Abonnements',
  'Catalogue',
  'Catégories',
  'Prise de commande',
];

it('ne propose aucun lien personnel/* à un visiteur', () => {
  // Régression : ces liens appartenaient à l'ancien header, avant que le
  // chantier sidebar (#144, #145) ne les déplace dans `LayoutPersonnel` —
  // jamais retirés d'ici, ils restaient visibles même hors session personnel.
  afficher();

  for (const libelle of LIBELLES_PERSONNEL_OBSOLETES) {
    expect(screen.queryByRole('link', { name: libelle })).toBeNull();
  }
});

it('ne propose aucun lien personnel/* à un client connecté', () => {
  definirSession('client');

  afficher();

  for (const libelle of LIBELLES_PERSONNEL_OBSOLETES) {
    expect(screen.queryByRole('link', { name: libelle })).toBeNull();
  }
});

it('n’affiche plus la navigation personnel/* complète à un salarié', () => {
  definirSession('personnel');

  afficher();

  for (const libelle of LIBELLES_PERSONNEL_OBSOLETES) {
    expect(screen.queryByRole('link', { name: libelle })).toBeNull();
  }
});

it('offre un unique lien « Espace personnel » au salarié connecté', () => {
  // Sans lui, un salarié connecté — `ConnexionPersonnelPage` redirige vers
  // `/`, la page d'accueil publique — n'aurait aucun moyen de revenir dans
  // son espace sans taper l'URL à la main.
  definirSession('personnel');

  afficher();

  const lien = screen.getByRole('link', { name: 'Espace personnel' });
  expect(lien).toHaveProperty('href', expect.stringContaining('/personnel/commandes'));
});

it('ne propose « Espace personnel » ni au visiteur ni au client', () => {
  afficher();
  expect(screen.queryByRole('link', { name: 'Espace personnel' })).toBeNull();

  definirSession('client');
  cleanup();
  afficher();
  expect(screen.queryByRole('link', { name: 'Espace personnel' })).toBeNull();
});

it('garde le lien public « Salles » distinct de la route admin', () => {
  // Attention de nommage explicitement signalée : `/salles` (catalogue
  // public) ne doit jamais être confondu avec `personnel/salles`
  // (administration), retiré par ce correctif.
  afficher();

  const lien = screen.getByRole('link', { name: 'Salles' });
  expect(lien).toHaveProperty('href', expect.stringContaining('/salles'));
  expect(lien).not.toHaveProperty('href', expect.stringContaining('/personnel/salles'));
});

it('se déconnecte sans rechargement : la nav se met à jour, le panier survit', async () => {
  // T0.10 retire le rechargement complet — le magasin réactif doit à lui
  // seul refléter la déconnexion. Le panier, lui, n'est **pas** une donnée de
  // session (aucune entité serveur, cf. `docs/mld.md`) : il doit survivre
  // intact, exactement comme il survit déjà à un rechargement de page.
  deconnecter.mockResolvedValue(undefined);
  definirSession('client');
  act(() => remplir(2));

  const utilisateur = userEvent.setup();
  afficher();
  await utilisateur.click(screen.getByRole('button', { name: /déconnexion/i }));

  await waitFor(() => expect(deconnecter).toHaveBeenCalledOnce());
  await waitFor(() => expect(lireSession().type).toBeNull());
  expect(screen.getByRole('link', { name: /connexion/i })).toBeDefined();
  expect(screen.queryByRole('button', { name: /déconnexion/i })).toBeNull();
  // Le panier n'a pas été vidé : il vit dans un magasin distinct
  // (`commande.panier.ts`), indépendant de la session.
  expect(screen.getByTestId('compteur-panier').textContent).toBe('2');
});
