/** Tests des libellés de statut — fonctions pures, sans appel ni rendu. */

import { describe, expect, it } from 'vitest';

import {
  ETAPES,
  estParcoursNominal,
  fraisLivraison,
  libelleStatut,
  resteAvantGratuite,
} from './livraison.service';
import type { StatutLivraison } from './livraison.types';

const TOUS: StatutLivraison[] = [
  'En_attente',
  'En_cours',
  'Livree',
  'Echouee',
  'Annulee',
];

describe('libelleStatut', () => {
  it.each(TOUS)('donne un libellé lisible pour %s', (statut) => {
    const libelle = libelleStatut(statut);

    // Aucun identifiant technique ne doit atteindre l'écran.
    expect(libelle.titre).not.toContain('_');
    expect(libelle.titre.length).toBeGreaterThan(0);
    expect(libelle.explication.length).toBeGreaterThan(0);
  });

  it('donne un titre distinct à chaque statut', () => {
    // Deux statuts au même libellé seraient indiscernables pour le client —
    // « échouée » et « annulée » notamment, qui n'appellent pas la même suite.
    const titres = TOUS.map((statut) => libelleStatut(statut).titre);

    expect(new Set(titres).size).toBe(TOUS.length);
  });

  it('dit explicitement qu’un échec ne demande aucune démarche', () => {
    // Le point central de l'issue : sans cette phrase, le client croit qu'il
    // doit agir et appelle le support pour rien.
    const libelle = libelleStatut('Echouee');

    expect(libelle.priseEnCharge).toBe(true);
    expect(libelle.explication).toMatch(/aucune démarche/i);
  });

  it('ne présente pas un échec comme une annulation', () => {
    // Deux statuts terminaux distincts côté serveur, et pour cause : l'un dit
    // que la tournée n'a pas abouti, l'autre qu'elle n'aura pas lieu.
    expect(libelleStatut('Echouee').titre).not.toMatch(/annul/i);
    expect(libelleStatut('Echouee').priseEnCharge).not.toBe(
      libelleStatut('Annulee').priseEnCharge
    );
  });

  it('retombe sur un libellé neutre pour un statut inconnu', () => {
    // Cas d'un déploiement décalé : l'API peut connaître un statut que ce
    // frontend ignore encore.
    const libelle = libelleStatut('Inattendu' as StatutLivraison);

    expect(libelle.titre).toBe('Suivi indisponible');
  });
});

describe('estParcoursNominal', () => {
  it.each(ETAPES)('%s fait partie du parcours', (statut) => {
    expect(estParcoursNominal(statut)).toBe(true);
  });

  it.each(['Echouee', 'Annulee'] as StatutLivraison[])('%s en sort', (statut) => {
    // Les afficher comme une étape parmi d'autres suggérerait que le
    // parcours continue, alors qu'il s'est arrêté.
    expect(estParcoursNominal(statut)).toBe(false);
  });
});

describe('fraisLivraison', () => {
  const TARIF = { forfait: '5000.00', seuil_gratuite: '100000.00' };

  it('applique le forfait sous le seuil, une fois quel que soit le montant', () => {
    expect(fraisLivraison(TARIF, 25000)).toBe(5000);
    expect(fraisLivraison(TARIF, 99999.99)).toBe(5000);
  });

  it('offre la livraison dès le seuil atteint', () => {
    expect(fraisLivraison(TARIF, 100000)).toBe(0);
  });

  it('sans seuil, la livraison n’est jamais offerte', () => {
    expect(fraisLivraison({ ...TARIF, seuil_gratuite: null }, 1e9)).toBe(5000);
  });
});

describe('resteAvantGratuite', () => {
  const TARIF = { forfait: '5000.00', seuil_gratuite: '100000.00' };

  it('dit ce qu’il reste à acheter, ou null une fois le seuil atteint', () => {
    expect(resteAvantGratuite(TARIF, 75000)).toBe(25000);
    expect(resteAvantGratuite(TARIF, 100000)).toBeNull();
    expect(resteAvantGratuite({ ...TARIF, seuil_gratuite: null }, 0)).toBeNull();
  });
});
