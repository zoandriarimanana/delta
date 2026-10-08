/**
 * Textes des primitives visuelles — une version par langue.
 *
 * Aucun ne nomme une entité du MLD : ce sont des libellés d'interface
 * (afficher un mot de passe, une note sur 5), ce qui garde ces primitives
 * dans le critère d'admission de `components/ui/`.
 */

import type { Textes } from '@/lib/langue';

const fr = {
  masquerSaisie: 'Masquer la saisie',
  afficherSaisie: 'Afficher la saisie',
  masquerMotDePasse: 'Masquer le mot de passe',
  afficherMotDePasse: 'Afficher le mot de passe',
  pasEncoreNote: 'Pas encore noté',
  noteAccessible: (valeur: number, nombre: number) =>
    `Note moyenne : ${valeur} sur 5, ${nombre} avis`,
  note: (valeur: string, nombre: number) => `${valeur} sur 5 · ${nombre} avis`,
};

export const TEXTES_UI: Textes<typeof fr> = {
  fr,
  en: {
    masquerSaisie: 'Hide input',
    afficherSaisie: 'Show input',
    masquerMotDePasse: 'Hide password',
    afficherMotDePasse: 'Show password',
    pasEncoreNote: 'Not rated yet',
    noteAccessible: (valeur: number, nombre: number) =>
      `Average rating: ${valeur} out of 5, ${nombre} review(s)`,
    note: (valeur: string, nombre: number) =>
      `${valeur} out of 5 · ${nombre} review(s)`,
  },
};
