/**
 * Tests de la garde de route personnel.
 *
 * Elle n'est **pas** une protection : ce qui protège, ce sont les dépendances
 * FastAPI qui refusent la donnée. Elle évite d'afficher une page inutilisable —
 * et c'est cela qu'on vérifie ici.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import RoutePersonnel from './RoutePersonnel';
import { effacerJeton, enregistrerSession } from './tokenStorage';

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

beforeEach(() => effacerJeton());
afterEach(() => {
  cleanup();
  effacerJeton();
});

describe('RoutePersonnel', () => {
  it('rend la page pour un salarié connecté', () => {
    // Contrôle positif : sans lui, une garde qui refuserait tout passerait les
    // trois cas de refus ci-dessous.
    enregistrerSession('jeton', 'personnel');

    afficher();

    expect(screen.getByText('Contenu réservé')).toBeDefined();
  });

  it('redirige un visiteur non connecté', () => {
    afficher();

    expect(screen.getByText('Connexion personnel')).toBeDefined();
    expect(screen.queryByText('Contenu réservé')).toBeNull();
  });

  it('redirige un client connecté', () => {
    // Les clés primaires de `CLIENT` et `PERSONNEL` se recouvrent : un jeton
    // client ne doit jamais ouvrir une page personnel, même si son porteur est
    // authentifié.
    enregistrerSession('jeton', 'client');

    afficher();

    expect(screen.getByText('Connexion personnel')).toBeDefined();
    expect(screen.queryByText('Contenu réservé')).toBeNull();
  });

  it('redirige quand le type manque au stockage', () => {
    localStorage.setItem('delta.access_token', 'jeton.orphelin');

    afficher();

    expect(screen.getByText('Connexion personnel')).toBeDefined();
  });
});
