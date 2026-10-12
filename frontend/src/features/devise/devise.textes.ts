/** Textes du module devise (parcours client) — une version par langue. */

import type { Textes } from '@/lib/langue';

const fr = {
  payerEn: 'Payer en',
  soitEnviron: 'Soit environ, par carte',
  noteDevise:
    'Paiement par carte bancaire internationale (Visa, Mastercard, American Express). Montant indicatif : le taux du jour est figé à la validation.',
};

export const TEXTES_DEVISE: Textes<typeof fr> = {
  fr,
  en: {
    payerEn: 'Pay in',
    soitEnviron: 'About, by card',
    noteDevise:
      'Payment by international bank card (Visa, Mastercard, American Express). Indicative amount: today’s rate is locked in when you place the order.',
  },
};
