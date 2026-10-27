/** Textes de la galerie publique — une version par langue. */

import type { Textes } from '@/lib/langue';

const fr = {
  photoSur: (nom: string, rang: number, total: number) =>
    `${nom}, photo ${rang} sur ${total}`,
  agrandir: 'Agrandir la photo',
  precedente: 'Photo précédente',
  suivante: 'Photo suivante',
  miniatures: 'Miniatures',
  afficher: (rang: number) => `Afficher la photo ${rang}`,
  photosDe: (nom: string) => `Photos de ${nom}`,
  fermer: 'Fermer',
};

export const TEXTES_GALERIE: Textes<typeof fr> = {
  fr,
  en: {
    photoSur: (nom: string, rang: number, total: number) =>
      `${nom}, photo ${rang} of ${total}`,
    agrandir: 'Enlarge photo',
    precedente: 'Previous photo',
    suivante: 'Next photo',
    miniatures: 'Thumbnails',
    afficher: (rang: number) => `Show photo ${rang}`,
    photosDe: (nom: string) => `Photos of ${nom}`,
    fermer: 'Close',
  },
};
