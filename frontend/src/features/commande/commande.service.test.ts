/** Tests des règles du panier — fonctions pures, sans stockage ni rendu. */

import { describe, expect, it } from 'vitest';

import {
  PERSONNALISATION_VIDE,
  PERSONNES_MAX,
  ajouterAuPanier,
  bornesQuantite,
  definirPersonnalisation,
  descriptionDemande,
  formaterDate,
  formaterMontant,
  libelleStatutCommande,
  modifierQuantite,
  nombreArticles,
  retirerDuPanier,
  supplementLigne,
  totalPanier,
  versCibleAcheteur,
  versLignesEnvoyees,
  versPersonnalisationEnvoyee,
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
    supplement_personnalisation: null,
    est_livrable: true,
    vendu_par_personne: false,
    personnes_min: null,
    id_categorie: 1,
    note_moyenne: null,
    nombre_avis: 0,
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

describe('formaterDate', () => {
  it('rend une date lisible en français', () => {
    const rendu = formaterDate('2026-07-29T09:30:00+00:00');

    expect(rendu).toContain('juillet');
    expect(rendu).toContain('2026');
  });

  it('rend la valeur brute plutôt qu’« Invalid Date »', () => {
    // Une donnée illisible vaut mieux qu'un message qui ressemble à un bogue.
    expect(formaterDate('pas une date')).toBe('pas une date');
  });
});

describe('versCibleAcheteur', () => {
  it('construit la cible réservation', () => {
    expect(versCibleAcheteur('reservation', '42', '', '')).toEqual({
      id_reservation: 42,
    });
  });

  it('construit la cible invitée, espaces retirés', () => {
    expect(versCibleAcheteur('invite', '', '  Jean  ', ' 0340000000 ')).toEqual({
      nom_invite: 'Jean',
      contact_invite: '0340000000',
    });
  });

  it('ne mélange jamais les deux formes', () => {
    // Le serveur refuse les deux ensemble en 422 : la fonction ne peut pas les
    // produire, ce qui rend le refus inatteignable depuis l'écran.
    const surReservation = versCibleAcheteur('reservation', '42', 'Jean', '0340');
    const surInvite = versCibleAcheteur('invite', '42', 'Jean', '0340');

    expect(surReservation).not.toHaveProperty('nom_invite');
    expect(surInvite).not.toHaveProperty('id_reservation');
  });

  it('rend null sur une saisie incomplète', () => {
    // L'écran le traduit en bouton désactivé, plutôt qu'en appel voué au refus.
    expect(versCibleAcheteur('reservation', '', '', '')).toBeNull();
    expect(versCibleAcheteur('reservation', 'abc', '', '')).toBeNull();
    expect(versCibleAcheteur('reservation', '0', '', '')).toBeNull();
    expect(versCibleAcheteur('invite', '', 'Jean', '')).toBeNull();
    expect(versCibleAcheteur('invite', '', '', '0340')).toBeNull();
    expect(versCibleAcheteur('invite', '', '   ', '   ')).toBeNull();
  });
});

describe('personnalisation', () => {
  const GATEAU = produit({
    id_produit: 9,
    prix_unitaire: '25000.00',
    est_personnalisable: true,
    supplement_personnalisation: '5000.00',
    stock_disponible: 10,
  });
  const DEMANDE = {
    ...PERSONNALISATION_VIDE,
    message: 'Joyeux anniversaire Lova',
    theme: '  licornes, rose  ',
    ingredients: 'sans fruits à coque',
  };

  it('assemble une description lisible, une rubrique par ligne, sans rubrique vide', () => {
    expect(descriptionDemande(DEMANDE)).toBe(
      'Message à écrire : Joyeux anniversaire Lova\nThème et couleurs : licornes, rose'
    );
    expect(descriptionDemande(PERSONNALISATION_VIDE)).toBe('');
  });

  it('envoie la description et les ingrédients, jamais le supplément', () => {
    expect(versPersonnalisationEnvoyee(DEMANDE)).toEqual({
      description_demande:
        'Message à écrire : Joyeux anniversaire Lova\nThème et couleurs : licornes, rose',
      ingredients_specifiques: 'sans fruits à coque',
    });
    expect(
      versPersonnalisationEnvoyee({ ...DEMANDE, ingredients: '  ' })
    ).not.toHaveProperty('ingredients_specifiques');
  });

  it('la ligne porte la personnalisation et le supplément compte dans le total', () => {
    const panier = ajouterAuPanier([], GATEAU, 2, DEMANDE);

    expect(panier[0]?.personnalisation).toEqual(DEMANDE);
    expect(supplementLigne(panier[0]!)).toBe(10000);
    expect(totalPanier(panier)).toBe(60000);
    expect(versLignesEnvoyees(panier)[0]).toEqual({
      id_produit: 9,
      quantite: 2,
      personnalisation: versPersonnalisationEnvoyee(DEMANDE),
    });
  });

  it('sans personnalisation, aucun supplément et rien n’est envoyé', () => {
    const panier = ajouterAuPanier([], GATEAU, 2);

    expect(totalPanier(panier)).toBe(50000);
    expect(versLignesEnvoyees(panier)[0]).not.toHaveProperty('personnalisation');
  });

  it('une personnalisation vide ou nulle retire celle de la ligne', () => {
    const panier = ajouterAuPanier([], GATEAU, 1, DEMANDE);

    expect(
      definirPersonnalisation(panier, 9, PERSONNALISATION_VIDE)[0]
    ).not.toHaveProperty('personnalisation');
    expect(definirPersonnalisation(panier, 9, null)[0]).not.toHaveProperty(
      'personnalisation'
    );
  });

  it('un nouvel ajout personnalisé remplace la demande et cumule la quantité', () => {
    const panier = ajouterAuPanier([], GATEAU, 1, DEMANDE);
    const autre = { ...PERSONNALISATION_VIDE, message: 'Bonne retraite' };

    const resultat = ajouterAuPanier(panier, GATEAU, 1, autre);

    expect(resultat).toHaveLength(1);
    expect(resultat[0]?.quantite).toBe(2);
    expect(resultat[0]?.personnalisation).toEqual(autre);
  });
});

describe('vente à la personne', () => {
  const GATEAU = produit({
    id_produit: 12,
    prix_unitaire: '5000.00',
    unite_mesure: 'pièce',
    stock_disponible: 2,
    vendu_par_personne: true,
    personnes_min: 4,
  });

  it('une ligne est un gâteau : quantité en personnes, au minimum, unité « personne »', () => {
    const panier = ajouterAuPanier([], GATEAU, 2);

    expect(panier[0]?.quantite).toBe(4);
    expect(panier[0]?.unite_mesure).toBe('personne');
    expect(totalPanier(panier)).toBe(20000);
  });

  it('le nombre de personnes n’est pas borné au stock de gâteaux', () => {
    const panier = ajouterAuPanier([], GATEAU, 30);

    expect(panier[0]?.quantite).toBe(30);
    expect(bornesQuantite(panier[0]!)).toEqual({ min: 4, max: PERSONNES_MAX });
  });

  it('un nouvel ajout remplace le nombre de personnes au lieu de l’ajouter', () => {
    const panier = ajouterAuPanier(ajouterAuPanier([], GATEAU, 8), GATEAU, 6);

    expect(panier).toHaveLength(1);
    expect(panier[0]?.quantite).toBe(6);
  });

  it('modifier sous le minimum ramène au minimum', () => {
    const panier = modifierQuantite(ajouterAuPanier([], GATEAU, 8), 12, 2);

    expect(panier[0]?.quantite).toBe(4);
  });

  it('un gâteau pour 8 personnes compte pour un article', () => {
    const eclair = produit({ id_produit: 13, stock_disponible: 10 });
    const panier = ajouterAuPanier(ajouterAuPanier([], GATEAU, 8), eclair, 3);

    expect(nombreArticles(panier)).toBe(4);
  });
});

describe('libelleStatutCommande', () => {
  it('traduit chaque statut du domaine, sans identifiant technique', () => {
    for (const statut of [
      'En_attente',
      'Confirmee',
      'En_preparation',
      'Livree',
      'Servie',
      'Annulee',
    ] as const) {
      expect(libelleStatutCommande(statut)).not.toContain('_');
    }
    expect(libelleStatutCommande('En_preparation')).toBe('En préparation');
  });

  it('retombe sur un libellé neutre pour un statut inconnu', () => {
    expect(libelleStatutCommande('Inconnu' as never)).toBe('Statut inconnu');
  });
});
