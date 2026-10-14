import { describe, expect, it } from 'vitest';

import { classer, part } from './tableauDeBord.service';
import type { VenteProduit } from './tableauDeBord.types';

const vente = (id: number, unites: number, chiffre: string): VenteProduit => ({
  id_produit: id,
  nom: `Produit ${id}`,
  unites_vendues: unites,
  chiffre_affaires: chiffre,
  nombre_commandes: 1,
});

const VENTES = [
  vente(1, 10, '10000.00'),
  vente(2, 3, '90000.00'),
  vente(3, 7, '7000.00'),
];

describe('classer', () => {
  it('par quantité, puis par chiffre d’affaires', () => {
    expect(classer(VENTES, 'quantite').map((v) => v.id_produit)).toEqual([1, 3, 2]);
    expect(classer(VENTES, 'chiffre').map((v) => v.id_produit)).toEqual([2, 1, 3]);
  });

  it('garde les premiers seulement', () => {
    expect(classer(VENTES, 'quantite', 2)).toHaveLength(2);
  });
});

describe('part', () => {
  it('se mesure au premier du classement', () => {
    expect(part(vente(9, 5, '0'), VENTES[0], 'quantite')).toBe(50);
    expect(part(vente(9, 5, '0'), undefined, 'quantite')).toBe(0);
  });
});
