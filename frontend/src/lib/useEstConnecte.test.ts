/** Tests de `useEstConnecte`, `useEstPersonnelConnecte`, `useSession`, `useChargementSession`. */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { definirSession, effacerSession } from './session.store';
import {
  useChargementSession,
  useEstConnecte,
  useEstPersonnelConnecte,
  useSession,
} from './useEstConnecte';

beforeEach(effacerSession);
afterEach(effacerSession);

it('est faux sans session', () => {
  expect(renderHook(() => useEstConnecte()).result.current).toBe(false);
});

it('est vrai dès qu’une session client est ouverte', () => {
  definirSession('client');

  expect(renderHook(() => useEstConnecte()).result.current).toBe(true);
});

it('distingue les deux populations', () => {
  // Les clés primaires de `CLIENT` et `PERSONNEL` se recouvrent : un salarié
  // qui passerait pour un client ouvrirait des pages dont l'API refuserait sa
  // requête, ce qui effacerait sa session de travail.
  definirSession('personnel');

  expect(renderHook(() => useEstConnecte()).result.current).toBe(false);
  expect(renderHook(() => useEstPersonnelConnecte()).result.current).toBe(true);
});

it('un client n’est pas un membre du personnel', () => {
  definirSession('client');

  expect(renderHook(() => useEstPersonnelConnecte()).result.current).toBe(false);
});

it('useSession rend la population, ou null', () => {
  expect(renderHook(() => useSession()).result.current).toBeNull();

  definirSession('personnel');
  expect(renderHook(() => useSession()).result.current).toBe('personnel');
});

it('useChargementSession reflète l’état de chargement du magasin', () => {
  // `effacerSession()` du `beforeEach` lève déjà `chargement`, comme le ferait
  // une vraie réponse de `GET /auth/moi` — ce hook doit donc lire `false`.
  expect(renderHook(() => useChargementSession()).result.current).toBe(false);

  definirSession('client');
  expect(renderHook(() => useChargementSession()).result.current).toBe(false);
});
