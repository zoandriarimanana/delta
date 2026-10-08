/** Textes du module avis — une version par langue. */

import type { Textes } from '@/lib/langue';

const fr = {
  erreur: 'L’avis n’a pas pu être enregistré. Réessayez dans un instant.',
  merci: 'Merci, votre avis a été enregistré.',
  note: 'Note',
  commentaire: 'Commentaire (facultatif)',
  envoi: 'Envoi…',
  deposer: 'Déposer mon avis',
};

export const TEXTES_AVIS: Textes<typeof fr> = {
  fr,
  en: {
    erreur: 'Your review could not be saved. Please try again shortly.',
    merci: 'Thank you, your review has been saved.',
    note: 'Rating',
    commentaire: 'Comment (optional)',
    envoi: 'Sending…',
    deposer: 'Submit my review',
  },
};
