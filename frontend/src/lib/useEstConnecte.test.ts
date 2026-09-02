/** Tests de `useEstConnecte`. */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { effacerJeton, enregistrerSession } from './tokenStorage';
import { useEstConnecte, useEstPersonnelConnecte, useSession } from './useEstConnecte';

beforeEach(effacerJeton);
afterEach(effacerJeton);

it('est faux sans jeton', () => {
  expect(renderHook(() => useEstConnecte()).result.current).toBe(false);
});

it('est vrai dès qu’un jeton est stocké', () => {
  enregistrerSession('jeton.de.test', 'client');

  expect(renderHook(() => useEstConnecte()).result.current).toBe(true);
});

it('ne juge pas de la validité du jeton', () => {
  // Seul le serveur en juge : un jeton expiré reste « connecté » pour ce hook,
  // et c'est l'appel refusé qui déclenchera la redirection.
  enregistrerSession('jeton.expire.mais.present', 'client');

  expect(renderHook(() => useEstConnecte()).result.current).toBe(true);
});

it('distingue les deux populations', () => {
  // Les clés primaires de `CLIENT` et `PERSONNEL` se recouvrent : un salarié
  // qui passerait pour un client ouvrirait des pages dont l'API refuserait le
  // jeton, ce qui effacerait sa session de travail.
  enregistrerSession('jeton.personnel', 'personnel');

  expect(renderHook(() => useEstConnecte()).result.current).toBe(false);
  expect(renderHook(() => useEstPersonnelConnecte()).result.current).toBe(true);
});

it('un client n’est pas un membre du personnel', () => {
  enregistrerSession('jeton.client', 'client');

  expect(renderHook(() => useEstPersonnelConnecte()).result.current).toBe(false);
});

it('useSession rend la population, ou null', () => {
  expect(renderHook(() => useSession()).result.current).toBeNull();

  enregistrerSession('jeton', 'personnel');
  expect(renderHook(() => useSession()).result.current).toBe('personnel');
});

it('ignore un jeton dépourvu de type', () => {
  // Reliquat d'une version antérieure au cloisonnement : le lire comme une
  // session client rouvrirait la confusion d'identité que le type ferme.
  localStorage.setItem('delta.access_token', 'jeton.orphelin');

  expect(renderHook(() => useEstConnecte()).result.current).toBe(false);
  expect(renderHook(() => useEstPersonnelConnecte()).result.current).toBe(false);
});
