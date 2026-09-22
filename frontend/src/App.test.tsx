/**
 * Tests de la table de routes.
 *
 * `App` monte un `BrowserRouter`, qui lit `window.location` : on positionne
 * donc l'URL via `history.pushState` avant chaque rendu, plutôt que de
 * dupliquer la table de routes dans un `MemoryRouter` — un test qui recopie
 * les routes ne prouve pas que les vraies sont correctes.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { definirSession, effacerSession } from '@/lib/session.store';

import App from './App';

function afficherA(chemin: string) {
  window.history.pushState({}, '', chemin);
  return render(<App />);
}

afterEach(() => {
  cleanup();
  effacerSession();
});

describe('routage', () => {
  it("affiche la page d'accueil à la racine", () => {
    afficherA('/');

    expect(screen.getByRole('heading', { name: /Bienvenue chez Delta/ })).toBeDefined();
  });

  it('affiche la page de connexion sur /connexion', () => {
    afficherA('/connexion');

    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeDefined();
  });

  it('affiche la page 404 sur une URL inconnue', () => {
    afficherA('/cette-route-nexiste-pas');

    expect(screen.getByRole('heading', { name: '404' })).toBeDefined();
  });

  it('rend le layout autour de chaque page', () => {
    // Le 404 passe lui aussi par le layout : la navigation reste accessible
    // depuis une URL erronée, l'utilisateur n'est pas coincé.
    afficherA('/cette-route-nexiste-pas');

    expect(screen.getByRole('navigation')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Accueil' })).toBeDefined();
    expect(screen.getByRole('contentinfo')).toBeDefined();
  });

  it('affiche la connexion personnel sous MainLayout, pas la sidebar', () => {
    // Décision actée du chantier sidebar : `personnel/connexion` est la
    // porte d'entrée, pas l'espace lui-même — elle garde la nav horizontale.
    afficherA('/personnel/connexion');

    expect(screen.getByRole('heading', { name: 'Espace personnel' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Accueil' })).toBeDefined();
  });

  it('une URL personnel/* inconnue retombe sur le 404 sous MainLayout', () => {
    // Aucun personnel connecté ici : la route parente `personnel` ne
    // matche aucun de ses enfants pour ce chemin, et le routeur retombe sur
    // le catch-all de l'arbre `/` plutôt que d'afficher un tiroir vide.
    afficherA('/personnel/cette-route-nexiste-pas');

    expect(screen.getByRole('heading', { name: '404' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Accueil' })).toBeDefined();
  });

  it('redirige vers la connexion personnel un visiteur non connecté sur personnel/*', () => {
    afficherA('/personnel/commandes');

    expect(screen.getByRole('heading', { name: 'Espace personnel' })).toBeDefined();
  });

  it('affiche la sidebar pour un salarié connecté sur personnel/*', () => {
    definirSession('personnel', false);

    afficherA('/personnel/commandes');

    expect(screen.getByRole('link', { name: /prise de commande/i })).toBeDefined();
    // Deux liens « Delta » coexistent dans le DOM (sidebar desktop, barre
    // mobile) : CSS en montre un seul à la fois selon la largeur d'écran,
    // que jsdom ne simule pas — `getAllByRole` plutôt que `getByRole`.
    expect(screen.getAllByRole('link', { name: 'Delta' }).length).toBeGreaterThan(0);
  });

  it("masque la section Gestion pour un salarié sans droit d'administration", () => {
    definirSession('personnel', false);

    afficherA('/personnel/commandes');

    expect(screen.queryByText('Gestion')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Salles' })).toBeNull();
  });

  it('affiche la section Gestion pour un salarié administrateur', () => {
    definirSession('personnel', true);

    afficherA('/personnel/commandes');

    expect(screen.getByText('Gestion')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Salles' })).toBeDefined();
  });
});
