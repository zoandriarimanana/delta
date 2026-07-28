/** Tests des règles du panier — fonctions pures, sans stockage ni rendu. */

import { describe, expect, it } from 'vitest';

import {
  ajouterAuPanier,
  formaterMontant,
  modifierQuantite,
  nombreArticles,
  retirerDuPanier,
  totalPanier,
  versLignesEnvoyees,
} from './commande.service';
import type { LignePanier } from './commande.types';
import type { Produit } from '@/features/produit/produit.types';

function produit(surcharge: Partial<Produit> = {}): Produit {
  return {
    id_produit: 1,
    nom: 'Éclair',
    description: null,
    prix_unitaire: '3.50',
    unite_mesure: 'piece',
    stock_disponible: 10,
    est_personnalisable: false,
    est_livrable: true,
    id_categorie: 1,
    ...surcharge,
  };
}

function ligne(surcharge: Partial<LignePanier> = {}): LignePanier {
  return {
    id_produit: 1,
    nom: 'Éclair',
    prix_unitaire: '3.50',
    unite_mesure: 'piece',
    quantite: 2,
    stock_disponible: 10,
    ...surcharge,
  };
}

describe('ajouterAuPanier', () => {
  it('ajoute une ligne au panier vide', () => {
    const panier = ajouterAuPanier([], produit());

    expect(panier).toHaveLength(1);
    expect(panier[0]?.quantite).toBe(1);
  });

  it('cumule la quantité si le produit est déjà présent', () => {
    const panier = ajouterAuPanier([ligne({ quantite: 2 })], produit(), 3);

    expect(panier).toHaveLength(1);
    expect(panier[0]?.quantite).toBe(5);
  });

  it('refuse un produit épuisé', () => {
    // Garde-fou d'interface : le serveur reste seul juge au moment de la
    // commande, par un décrément atomique.
    expect(ajouterAuPanier([], produit({ stock_disponible: 0 }))).toEqual([]);
  });

  it('borne la quantité au stock connu', () => {
    const panier = ajouterAuPanier([], produit({ stock_disponible: 3 }), 99);

    expect(panier[0]?.quantite).toBe(3);
  });

  it('ne modifie pas le panier reçu', () => {
    const initial: LignePanier[] = [];

    ajouterAuPanier(initial, produit());

    expect(initial).toEqual([]);
  });
});

describe('modifierQuantite', () => {
  it('fixe la quantité', () => {
    const panier = modifierQuantite([ligne()], 1, 5);

    expect(panier[0]?.quantite).toBe(5);
  });

  it('borne au stock', () => {
    const panier = modifierQuantite([ligne({ stock_disponible: 4 })], 1, 99);

    expect(panier[0]?.quantite).toBe(4);
  });

  it('retire la ligne si la quantité tombe à zéro', () => {
    // C'est le geste attendu quand on vide le champ de quantité ; laisser une
    // ligne à zéro dans le panier n'aurait aucun sens.
    expect(modifierQuantite([ligne()], 1, 0)).toEqual([]);
    expect(modifierQuantite([ligne()], 1, -2)).toEqual([]);
  });

  it('laisse les autres lignes intactes', () => {
    const panier = modifierQuantite([ligne(), ligne({ id_produit: 2 })], 1, 7);

    expect(panier[1]?.quantite).toBe(2);
  });
});

describe('retirerDuPanier', () => {
  it('retire la ligne visée', () => {
    const panier = retirerDuPanier([ligne(), ligne({ id_produit: 2 })], 1);

    expect(panier.map((l) => l.id_produit)).toEqual([2]);
  });
});

describe('totaux', () => {
  it('compte les articles, pas les lignes', () => {
    expect(
      nombreArticles([ligne({ quantite: 2 }), ligne({ id_produit: 2, quantite: 3 })])
    ).toBe(5);
  });

  it('additionne prix × quantité', () => {
    const total = totalPanier([
      ligne({ quantite: 2, prix_unitaire: '3.50' }),
      ligne({ id_produit: 2, quantite: 3, prix_unitaire: '5.00' }),
    ]);

    expect(total).toBe(22);
  });

  it('rend zéro pour un panier vide', () => {
    expect(totalPanier([])).toBe(0);
    expect(nombreArticles([])).toBe(0);
  });
});

describe('formaterMontant', () => {
  it('met en forme avec la devise', () => {
    const rendu = formaterMontant('15000');

    expect(rendu).toMatch(/15[\s\u00a0\u202f]?000,00/);
    expect(rendu).toContain('Ar');
  });

  it('rend une valeur illisible telle quelle plutôt qu’en NaN', () => {
    expect(formaterMontant('illisible')).not.toContain('NaN');
  });
});

describe('versLignesEnvoyees', () => {
  it('ne transmet que l’identifiant et la quantité', () => {
    // Le prix est déterminé par le serveur : l'envoyer n'aurait aucun effet,
    // le schema d'entrée ne l'expose pas.
    const envoyees = versLignesEnvoyees([ligne({ quantite: 4 })]);

    expect(envoyees).toEqual([{ id_produit: 1, quantite: 4 }]);
  });
});
