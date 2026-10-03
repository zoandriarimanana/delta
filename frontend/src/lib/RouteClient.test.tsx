/**
 * Tests de la garde de route client.
 *
 * Miroir de `RoutePersonnel.test.tsx` : elle n'est pas une protection — elle
 * évite d'afficher le header client à un salarié connecté, et c'est cela
 * qu'on vérifie ici.
 *
 * `useChargementSession`/`useSession` sont mockés plutôt que pilotés via le
 * vrai magasin de session : même raisonnement que `RoutePersonnel.test.tsx`,
 * le cas « vérification encore en cours » n'est atteignable qu'une fois.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RouteClient from './RouteClient';

const { useChargementSession, useSession } = vi.hoisted(() => ({
  useChargementSession: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock('./useEstConnecte', () => ({ useChargementSession, useSession }));

function afficher(entree: string) {
  return render(
    <MemoryRouter initialEntries={[entree]}>
      <Routes>
        <Route element={<RouteClient />}>
          <Route path="/" element={<p>Accueil publique</p>} />
          <Route path="/produits" element={<p>Catalogue produits</p>} />
        </Route>
        <Route path="/personnel" element={<p>Espace personnel</p>} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('RouteClient', () => {
  it('rend la page pour un client connecté', () => {
    useChargementSession.mockReturnValue(false);
    useSession.mockReturnValue('client');

    afficher('/');

    expect(screen.getByText('Accueil publique')).toBeDefined();
  });

  it('rend la page pour un visiteur non connecté', () => {
    // Contrôle positif : sans lui, une garde qui refuserait tout passerait le
    // cas de redirection ci-dessous.
    useChargementSession.mockReturnValue(false);
    useSession.mockReturnValue(null);

    afficher('/');

    expect(screen.getByText('Accueil publique')).toBeDefined();
  });

  it('redirige un salarié connecté, même sur une URL tapée directement', () => {
    useChargementSession.mockReturnValue(false);
    useSession.mockReturnValue('personnel');

    afficher('/produits');

    expect(screen.getByText('Espace personnel')).toBeDefined();
    expect(screen.queryByText('Catalogue produits')).toBeNull();
  });

  it('n’affiche ni le contenu ni une redirection tant que la session se vérifie', () => {
    // La vérification initiale (`GET /auth/moi`) est asynchrone : trancher
    // avant sa résolution écarterait à tort un client réellement connecté.
    useChargementSession.mockReturnValue(true);
    useSession.mockReturnValue(null);

    afficher('/');

    expect(screen.queryByText('Accueil publique')).toBeNull();
    expect(screen.queryByText('Espace personnel')).toBeNull();
  });
});
