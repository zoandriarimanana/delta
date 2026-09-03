/** Tests des règles d'affichage et de lecture du catalogue. */

import { describe, expect, it } from 'vitest';

import {
  DEVISE,
  TOUTES_CATEGORIES,
  depuisValeurSelect,
  estDisponible,
  formaterPrix,
  libelleCategorie,
  versParametreCategorie,
} from './produit.service';
import type { CategorieProduit, Produit } from './produit.types';

function produit(surcharge: Partial<Produit> = {}): Produit {
  return {
    id_produit: 1,
    nom: 'Éclair au chocolat',
    description: null,
    prix_unitaire: '3.50',
    unite_mesure: 'piece',
    stock_disponible: 10,
    est_personnalisable: false,
    supplement_personnalisation: null,
    est_livrable: true,
    id_categorie: 1,
    ...surcharge,
  };
}

const CATEGORIES: CategorieProduit[] = [
  { id_categorie: 1, libelle: 'Pâtisserie' },
  { id_categorie: 2, libelle: 'Confiture' },
];

describe('formaterPrix', () => {
  it('convertit la chaîne du serveur et ajoute devise et unité', () => {
    const rendu = formaterPrix(produit());

    // Le séparateur de milliers dépend de la locale : on vérifie ce qui compte,
    // pas le caractère exact utilisé pour l'espacement.
    expect(rendu).toContain('3');
    expect(rendu).toContain('50');
    expect(rendu).toContain(DEVISE);
    expect(rendu).toContain('piece');
  });

  it('conserve deux décimales sur un prix entier', () => {
    expect(formaterPrix(produit({ prix_unitaire: '15000' }))).toMatch(
      /15[\s\u00a0\u202f]?000,00/
    );
  });

  it('rend une valeur illisible telle quelle plutôt qu’en NaN', () => {
    // Mieux vaut afficher une donnée inattendue que la masquer derrière « NaN ».
    const rendu = formaterPrix(produit({ prix_unitaire: 'illisible' }));

    expect(rendu).toContain('illisible');
    expect(rendu).not.toContain('NaN');
  });
});

describe('estDisponible', () => {
  it('dépend du stock', () => {
    expect(estDisponible(produit({ stock_disponible: 1 }))).toBe(true);
    expect(estDisponible(produit({ stock_disponible: 0 }))).toBe(false);
  });
});

describe('libelleCategorie', () => {
  it('retrouve le libellé', () => {
    expect(libelleCategorie(CATEGORIES, 2)).toBe('Confiture');
  });

  it('retourne undefined pour une catégorie absente du lot', () => {
    // Cas légitime : un produit peut référencer une catégorie archivée, que
    // l'API ne liste plus.
    expect(libelleCategorie(CATEGORIES, 99)).toBeUndefined();
  });
});

describe('filtre de catégorie', () => {
  it('traduit « toutes » par l’absence de paramètre', () => {
    expect(versParametreCategorie(TOUTES_CATEGORIES)).toBeUndefined();
  });

  it('transmet l’identifiant sélectionné', () => {
    expect(versParametreCategorie(2)).toBe(2);
  });

  it('lit une valeur de select numérique', () => {
    expect(depuisValeurSelect('2')).toBe(2);
  });

  it('retombe sur « toutes » pour une valeur non numérique', () => {
    // Sans cette garde, un `NaN` partirait dans l'URL de la requête.
    expect(depuisValeurSelect('abc')).toBe(TOUTES_CATEGORIES);
    expect(depuisValeurSelect(TOUTES_CATEGORIES)).toBe(TOUTES_CATEGORIES);
  });
});
