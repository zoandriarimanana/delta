/** Langue de l'interface : choix, mémorisation, locale et textes. */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CLE_LANGUE,
  definirLangue,
  lireLangue,
  localeCourante,
  textesCourants,
  useTextes,
  type Textes,
} from './langue';

const TEXTES: Textes<{ bonjour: string }> = {
  fr: { bonjour: 'Bonjour' },
  en: { bonjour: 'Hello' },
};

afterEach(() => {
  act(() => definirLangue('fr'));
  localStorage.clear();
});

describe('langue', () => {
  it('vaut le français par défaut', () => {
    expect(lireLangue()).toBe('fr');
    expect(localeCourante()).toBe('fr-FR');
  });

  it('mémorise le choix et met à jour l’attribut lang de la page', () => {
    act(() => definirLangue('en'));

    expect(localStorage.getItem(CLE_LANGUE)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localeCourante()).toBe('en-US');
  });

  it('sert les textes de la langue courante, hors composant comme dans un composant', () => {
    const { result } = renderHook(() => useTextes(TEXTES));
    expect(result.current.bonjour).toBe('Bonjour');

    act(() => definirLangue('en'));

    expect(result.current.bonjour).toBe('Hello');
    expect(textesCourants(TEXTES).bonjour).toBe('Hello');
  });
});
