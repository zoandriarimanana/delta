/** Tests de `useEstConnecte`. */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { effacerJeton, enregistrerJeton } from './tokenStorage';
import { useEstConnecte } from './useEstConnecte';

beforeEach(effacerJeton);
afterEach(effacerJeton);

it('est faux sans jeton', () => {
  expect(renderHook(() => useEstConnecte()).result.current).toBe(false);
});

it('est vrai dès qu’un jeton est stocké', () => {
  enregistrerJeton('jeton.de.test');

  expect(renderHook(() => useEstConnecte()).result.current).toBe(true);
});

it('ne juge pas de la validité du jeton', () => {
  // Seul le serveur en juge : un jeton expiré reste « connecté » pour ce hook,
  // et c'est l'appel refusé qui déclenchera la redirection.
  enregistrerJeton('jeton.expire.mais.present');

  expect(renderHook(() => useEstConnecte()).result.current).toBe(true);
});
