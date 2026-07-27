/**
 * Tests du pont événement HTTP → routage.
 *
 * Le nettoyage au démontage est testé explicitement : c'est le genre de fuite
 * qui ne casse rien immédiatement mais provoque des redirections en double dès
 * qu'un composant est remonté (navigation, StrictMode, hot reload).
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SessionExpiree from './SessionExpiree';
import { EVENEMENT_NON_AUTHENTIFIE } from './axiosClient';

function monter() {
  return render(
    <MemoryRouter initialEntries={['/prive']}>
      <SessionExpiree />
      <Routes>
        <Route path="/prive" element={<p>page privee</p>} />
        <Route path="/connexion" element={<p>page de connexion</p>} />
      </Routes>
    </MemoryRouter>
  );
}

/** Émet l'événement dans un `act` : la navigation part d'un écouteur DOM, donc
 *  hors du cycle React, et le rendu qui suit ne serait pas vidé sans ça. */
function emettreEvenement() {
  act(() => {
    window.dispatchEvent(new CustomEvent(EVENEMENT_NON_AUTHENTIFIE));
  });
}

afterEach(() => {
  // `globals: true` n'est pas activé dans la config vitest : le nettoyage
  // automatique de testing-library ne s'exécute donc pas tout seul. Sans cet
  // appel, les composants montés par un test restent en place pour le suivant.
  cleanup();
  vi.restoreAllMocks();
});

describe('SessionExpiree', () => {
  it('redirige vers /connexion à la réception de l’événement', () => {
    monter();
    expect(screen.getByText('page privee')).toBeDefined();

    emettreEvenement();

    expect(screen.getByText('page de connexion')).toBeDefined();
  });

  it('retire son écouteur au démontage', () => {
    const ajouts = vi.spyOn(window, 'addEventListener');
    const retraits = vi.spyOn(window, 'removeEventListener');
    const nôtres = (appels: [string, unknown][]) =>
      appels.filter(([nom]) => nom === EVENEMENT_NON_AUTHENTIFIE);

    const { unmount } = monter();
    const ajoutsFaits = nôtres(ajouts.mock.calls as [string, unknown][]);
    expect(ajoutsFaits.length).toBeGreaterThan(0);

    unmount();

    const retraitsFaits = nôtres(retraits.mock.calls as [string, unknown][]);
    // Autant de retraits que d'ajouts : aucun écouteur ne survit au démontage.
    expect(retraitsFaits).toHaveLength(ajoutsFaits.length);
    // Et sur la même référence de fonction — `removeEventListener` appelé avec
    // une autre fonction ne retirerait rien, et un test qui se contenterait de
    // vérifier que la méthode a été appelée passerait quand même.
    expect(retraitsFaits.at(-1)?.[1]).toBe(ajoutsFaits.at(-1)?.[1]);
  });

  it('ne redirige plus après démontage', () => {
    const { unmount } = monter();
    unmount();

    // Ne doit ni lever, ni agir : plus aucun écouteur n'est enregistré.
    expect(() => emettreEvenement()).not.toThrow();
  });

  it('ne rend aucun élément', () => {
    const { container } = render(
      <MemoryRouter>
        <SessionExpiree />
      </MemoryRouter>
    );

    expect(container.innerHTML).toBe('');
  });
});
