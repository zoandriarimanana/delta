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

import App from './App';

function afficherA(chemin: string) {
  window.history.pushState({}, '', chemin);
  return render(<App />);
}

afterEach(cleanup);

describe('routage', () => {
  it("affiche la page d'accueil à la racine", () => {
    afficherA('/');

    expect(screen.getByRole('heading', { name: 'Accueil' })).toBeDefined();
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
});
