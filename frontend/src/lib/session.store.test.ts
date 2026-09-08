/**
 * Tests du magasin de session réactif (T0.10).
 *
 * Remplace `tokenStorage.test.ts` : il n'y a plus de jeton ni de type à
 * valider depuis `localStorage` (le cookie qui porte la session est
 * `httpOnly`, invisible en JS) — ce qui reste à vérifier, c'est que le
 * magasin notifie correctement ses abonnés et distingue bien « pas connecté »
 * de « pas encore su ».
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  abonnerALaSession,
  definirSession,
  effacerSession,
  lireSession,
} from './session.store';

afterEach(() => {
  effacerSession();
});

describe('lireSession', () => {
  it('definirSession pose le type et lève chargement', () => {
    definirSession('personnel');

    expect(lireSession()).toEqual({ type: 'personnel', chargement: false });
  });

  it('effacerSession retire le type et lève chargement', () => {
    definirSession('client');

    effacerSession();

    expect(lireSession()).toEqual({ type: null, chargement: false });
  });

  it('definirSession remplace la session existante, y compris d’une autre population', () => {
    // Conséquence assumée du jeton unique typé : se connecter comme salarié
    // ferme la session cliente.
    definirSession('client');
    definirSession('personnel');

    expect(lireSession()).toEqual({ type: 'personnel', chargement: false });
  });
});

describe('abonnerALaSession', () => {
  it('notifie les abonnés à chaque écriture', () => {
    const notifier = vi.fn();
    const retrait = abonnerALaSession(notifier);

    definirSession('client');
    effacerSession();

    expect(notifier).toHaveBeenCalledTimes(2);
    retrait();
  });

  it('cesse de notifier après retrait', () => {
    const notifier = vi.fn();
    const retrait = abonnerALaSession(notifier);
    retrait();

    definirSession('client');

    expect(notifier).not.toHaveBeenCalled();
  });
});
