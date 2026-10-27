/** Liste des pays : codes ISO, noms fournis par le navigateur. */

import { describe, expect, it } from 'vitest';

import { listePays, nomPays } from './pays';

describe('pays', () => {
  it('nomme un pays dans la langue demandée', () => {
    expect(nomPays('MG', 'fr')).toBe('Madagascar');
    expect(nomPays('FR', 'en')).toBe('France');
    expect(nomPays('DE', 'fr')).toBe('Allemagne');
  });

  it('liste chaque code une fois, triée par nom', () => {
    const pays = listePays('fr');
    const codes = pays.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
    expect(codes).toContain('MG');
    const noms = pays.map((p) => p.nom);
    expect([...noms].sort((a, b) => a.localeCompare(b, 'fr'))).toEqual(noms);
  });
});
