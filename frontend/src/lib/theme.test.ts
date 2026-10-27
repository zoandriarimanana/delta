/** Tests du thème clair / sombre. */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLE_THEME, definirTheme, lireTheme } from './theme';

afterEach(() => {
  localStorage.clear();
  definirTheme('clair');
  vi.restoreAllMocks();
});

describe('definirTheme', () => {
  it('pose la classe dark sur <html> et mémorise le choix', () => {
    definirTheme('sombre');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(CLE_THEME)).toBe('sombre');
    expect(lireTheme()).toBe('sombre');
  });

  it('retire la classe en revenant au clair', () => {
    definirTheme('sombre');
    definirTheme('clair');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reste utilisable si le stockage est indisponible', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('stockage bloqué');
    });

    expect(() => definirTheme('sombre')).not.toThrow();
    expect(lireTheme()).toBe('sombre');
  });
});

describe('thème initial', () => {
  it('suit le réglage du système sans choix mémorisé, le choix sinon', async () => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    vi.resetModules();
    const systeme = await import('./theme');
    expect(systeme.lireTheme()).toBe('sombre');

    localStorage.setItem(CLE_THEME, 'clair');
    vi.resetModules();
    const memorise = await import('./theme');
    expect(memorise.lireTheme()).toBe('clair');
    vi.unstubAllGlobals();
  });
});
