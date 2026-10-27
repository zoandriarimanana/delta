/**
 * Tests de la garde de route personnel.
 *
 * Elle n'est **pas** une protection : ce qui protège, ce sont les dépendances
 * FastAPI qui refusent la donnée. Elle évite d'afficher une page inutilisable —
 * et c'est cela qu'on vérifie ici.
 *
 * `useChargementSession`/`useEstPersonnelConnecte` sont mockés plutôt que
 * pilotés via le vrai magasin de session : le cas « vérification encore en
 * cours » (T0.10) n'est atteignable qu'une fois, avant la première résolution
 * de `GET /auth/moi` — un module singleton partagé entre fichiers de test ne
 * peut pas y revenir à volonté une fois résolu ailleurs dans la suite.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RoutePersonnel from './RoutePersonnel';

const { useChargementSession, useEstPersonnelConnecte } = vi.hoisted(() => ({
  useChargementSession: vi.fn(),
  useEstPersonnelConnecte: vi.fn(),
}));

vi.mock('./useEstConnecte', () => ({ useChargementSession, useEstPersonnelConnecte }));

function afficher() {
  return render(
    <MemoryRouter initialEntries={['/reservee']}>
      <Routes>
        <Route
          path="/reservee"
          element={
            <RoutePersonnel>
              <p>Contenu réservé</p>
            </RoutePersonnel>
          }
        />
        <Route path="/personnel/connexion" element={<p>Connexion personnel</p>} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('RoutePersonnel', () => {
  it('rend la page pour un salarié connecté', () => {
    // Contrôle positif : sans lui, une garde qui refuserait tout passerait les
    // cas de refus ci-dessous.
    useChargementSession.mockReturnValue(false);
    useEstPersonnelConnecte.mockReturnValue(true);

    afficher();

    expect(screen.getByText('Contenu réservé')).toBeDefined();
  });

  it('redirige un visiteur non connecté', () => {
    useChargementSession.mockReturnValue(false);
    useEstPersonnelConnecte.mockReturnValue(false);

    afficher();

    expect(screen.getByText('Connexion personnel')).toBeDefined();
    expect(screen.queryByText('Contenu réservé')).toBeNull();
  });

  it('redirige un client connecté', () => {
    // Les clés primaires de `CLIENT` et `PERSONNEL` se recouvrent : une
    // session client ne doit jamais ouvrir une page personnel, même pour un
    // visiteur authentifié.
    useChargementSession.mockReturnValue(false);
    useEstPersonnelConnecte.mockReturnValue(false);

    afficher();

    expect(screen.getByText('Connexion personnel')).toBeDefined();
    expect(screen.queryByText('Contenu réservé')).toBeNull();
  });

  it('n’affiche ni le contenu ni une redirection tant que la session se vérifie', () => {
    // La vérification initiale (`GET /auth/moi`) est asynchrone : trancher
    // avant sa résolution redirigerait à tort un salarié réellement connecté.
    useChargementSession.mockReturnValue(true);
    useEstPersonnelConnecte.mockReturnValue(false);

    afficher();

    expect(screen.queryByText('Contenu réservé')).toBeNull();
    expect(screen.queryByText('Connexion personnel')).toBeNull();
  });
});
