/** Textes du module paiement — une version par langue. */

import type { Textes } from '@/lib/langue';

const fr = {
  erreur: 'Le paiement n’a pas pu être traité. Réessayez dans un instant.',
  montantAPayer: 'Montant à payer :',
  moyenPaiement: 'Moyen de paiement',
  carte: 'Carte bancaire internationale',
  carteDetail: 'Visa, Mastercard, American Express',
  mobileMoney: 'Mobile money',
  mobileMoneyDetail: 'MVola, Orange Money, Airtel Money',
  ariaryUniquement: 'Disponible uniquement en Ariary',
  operateur: 'Opérateur',
  envoi: 'Envoi…',
  payer: 'Payer cette commande',
  statutPaiement: 'Statut du paiement :',
  statuts: {
    En_attente: 'En attente de confirmation',
    Reussi: 'Paiement réussi',
    Echoue: 'Paiement échoué',
  } as Record<string, string>,
  simuler: 'Simuler la confirmation (en attendant les accès fournisseurs réels)',
  merci: 'Merci, votre paiement a été confirmé.',
};

export const TEXTES_PAIEMENT: Textes<typeof fr> = {
  fr,
  en: {
    erreur: 'The payment could not be processed. Please try again shortly.',
    montantAPayer: 'Amount to pay:',
    moyenPaiement: 'Payment method',
    carte: 'International bank card',
    carteDetail: 'Visa, Mastercard, American Express',
    mobileMoney: 'Mobile money',
    mobileMoneyDetail: 'MVola, Orange Money, Airtel Money',
    ariaryUniquement: 'Only available in Ariary',
    operateur: 'Operator',
    envoi: 'Sending…',
    payer: 'Pay for this order',
    statutPaiement: 'Payment status:',
    statuts: {
      En_attente: 'Awaiting confirmation',
      Reussi: 'Payment successful',
      Echoue: 'Payment failed',
    },
    simuler: 'Simulate confirmation (until real provider access is available)',
    merci: 'Thank you, your payment has been confirmed.',
  },
};
