/** Textes du module devise (parcours client) — une version par langue. */

import type { Textes } from '@/lib/langue';

const fr = {
  devise: 'Devise',
  payerEn: 'Payer en',
  noteDevise:
    'Paiement par carte bancaire internationale (Visa, Mastercard, American Express). Montant indicatif : le taux du jour est figé à la validation.',
};

export const TEXTES_DEVISE: Textes<typeof fr> = {
  fr,
  en: {
    devise: 'Currency',
    payerEn: 'Pay in',
    noteDevise:
      'Payment by international bank card (Visa, Mastercard, American Express). Indicative amount: today’s rate is locked in when you place the order.',
  },
};
