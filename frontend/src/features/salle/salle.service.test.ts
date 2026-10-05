/** Tests du libellé de tarification d'une salle. */

import { describe, expect, it } from 'vitest';

import {
  explicationLocation,
  libelleTarif,
  listeEquipements,
  modesLocation,
} from './salle.service';
import type { Salle } from './salle.types';

function salle(tarifHoraire: string | null, tarifJournee: string | null): Salle {
  return {
    id_salle: 1,
    nom: 'Atelier',
    capacite: 12,
    tarif_horaire: tarifHoraire,
    tarif_journee: tarifJournee,
    equipements: null,
    description: null,
    note_moyenne: null,
    nombre_avis: 0,
  };
}

describe('libelleTarif', () => {
  it('annonce les deux tarifs quand la salle en porte deux', () => {
    const libelle = libelleTarif(salle('15000.00', '90000.00'));

    expect(libelle).toMatch(/heure/);
    expect(libelle).toMatch(/journée/);
  });

  it('n’annonce que l’heure si la journée n’est pas tarifée', () => {
    // Cas courant, et non une donnée manquante : le `CHECK` en base exige un
    // tarif, pas les deux (cf. `docs/mld.md`).
    const libelle = libelleTarif(salle('15000.00', null));

    expect(libelle).toMatch(/heure/);
    expect(libelle).not.toMatch(/journée/);
  });

  it('n’annonce que la journée si l’heure n’est pas tarifée', () => {
    const libelle = libelleTarif(salle(null, '90000.00'));

    expect(libelle).toMatch(/journée/);
    expect(libelle).not.toMatch(/heure/);
  });

  it('distingue la gratuité d’un tarif absent', () => {
    // `0.00` est une décision, pas une omission : c'est précisément ce que le
    // `CHECK` impose d'écrire pour rendre une salle gratuite.
    expect(libelleTarif(salle('0.00', null))).toMatch(/heure/);
  });

  it('retombe sur un libellé neutre si l’API contredit son propre schéma', () => {
    // Non représentable en base. S'il se présentait, mieux vaut un libellé
    // neutre qu'une chaîne vide dont personne ne comprendrait la cause.
    expect(libelleTarif(salle(null, null))).toBe('Tarif non communiqué');
  });
});

describe('explicationLocation', () => {
  it('nomme la capacité et les deux modes quand la salle porte deux tarifs', () => {
    const texte = explicationLocation(salle('15000.00', '90000.00'));

    expect(texte).toContain('12 personne(s)');
    expect(texte).toContain('à l’heure ou à la journée');
    expect(texte).toContain('Mes réservations');
  });

  it('ne nomme que le mode réellement tarifé', () => {
    expect(explicationLocation(salle(null, '90000.00'))).toContain(
      'Elle se loue à la journée.'
    );
  });
});

describe('modesLocation', () => {
  it('suit les tarifs renseignés, gratuité comprise', () => {
    expect(modesLocation(salle('0.00', null))).toEqual(['À l’heure']);
    expect(modesLocation(salle('1.00', '2.00'))).toEqual(['À l’heure', 'À la journée']);
  });
});

describe('listeEquipements', () => {
  it('découpe sur les virgules, points-virgules et retours à la ligne', () => {
    const avec = {
      ...salle('1.00', null),
      equipements: 'Wifi, Écran ;Sono\n  Tableau ',
    };

    expect(listeEquipements(avec)).toEqual(['Wifi', 'Écran', 'Sono', 'Tableau']);
  });

  it('rend une liste vide sans équipement', () => {
    expect(listeEquipements(salle('1.00', null))).toEqual([]);
  });
});
