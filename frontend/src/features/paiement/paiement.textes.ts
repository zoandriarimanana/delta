/** Textes du module paiement — une version par langue. */

import type { Textes } from '@/lib/langue';

const fr = {
  erreur: 'Le paiement n’a pas pu être traité. Réessayez dans un instant.',
  // Choix
  titreMobile: 'Payer par mobile money',
  sousTitreMobile: 'Choisissez votre opérateur et indiquez votre numéro.',
  montantAPayer: 'Montant à payer',
  operateur: 'Opérateur',
  numero: 'Numéro mobile money',
  exempleNumero: '034 12 345 67',
  numeroDe: (nom: string) => `Numéro ${nom} détecté`,
  numeroInconnu: 'Ce numéro ne correspond à aucun opérateur mobile money.',
  payerAvec: (montant: string, nom: string) => `Payer ${montant} avec ${nom}`,
  envoi: 'Envoi de la demande…',
  securite:
    'Vous validerez le paiement sur votre téléphone, avec votre code secret. Delta ne vous le demandera jamais.',
  ouCarte: 'Payer plutôt par carte bancaire internationale',
  ouMobile: 'Payer plutôt par mobile money',
  titreCarte: 'Payer par carte bancaire internationale',
  carteDetail: 'Visa, Mastercard, American Express',
  payerCarte: (montant: string) => `Payer ${montant} par carte`,
  carteSeulement:
    'Cette commande est en devise : elle se paie par carte bancaire internationale. Le mobile money ne fonctionne qu’en Ariary.',
  // Attente
  titreAttente: 'Validez le paiement sur votre téléphone',
  demandeEnvoyee: (montant: string, numero: string, nom: string) =>
    `Une demande de ${montant} a été envoyée au ${numero} (${nom}). Composez votre code secret pour confirmer.`,
  enAttenteDe: (nom: string) => `En attente de la confirmation de ${nom}…`,
  etapes: [
    'Une notification ou un message s’affiche sur votre téléphone.',
    'Vérifiez le montant, puis saisissez votre code secret.',
    'La confirmation s’affiche ici automatiquement.',
  ],
  rienRecu: 'Je n’ai rien reçu — changer de numéro',
  delaiDepasse:
    'Aucune confirmation reçue pour l’instant. Si vous avez validé, elle arrivera dans quelques instants ; sinon, recommencez.',
  recommencer: 'Recommencer',
  attenteCarte: 'Paiement par carte en cours de traitement…',
  simuler: 'Simuler la confirmation de l’opérateur (développement)',
  // Fin
  reussi: 'Paiement reçu — votre commande est confirmée.',
  merci: 'Merci ! Nous préparons votre commande.',
  reussiAcompte: 'Acompte reçu — votre réservation est confirmée.',
  merciAcompte: 'Merci ! Le solde se règle sur place.',
  echoue: 'Le paiement n’a pas abouti.',
  echoueDetail:
    'Aucun montant n’a été débité. Vérifiez le solde de votre compte, puis réessayez.',
  reessayer: 'Réessayer',
};

export const TEXTES_PAIEMENT: Textes<typeof fr> = {
  fr,
  en: {
    erreur: 'The payment could not be processed. Please try again shortly.',
    titreMobile: 'Pay with mobile money',
    sousTitreMobile: 'Choose your operator and enter your number.',
    montantAPayer: 'Amount to pay',
    operateur: 'Operator',
    numero: 'Mobile money number',
    exempleNumero: '034 12 345 67',
    numeroDe: (nom: string) => `${nom} number detected`,
    numeroInconnu: 'This number does not match any mobile money operator.',
    payerAvec: (montant: string, nom: string) => `Pay ${montant} with ${nom}`,
    envoi: 'Sending request…',
    securite:
      'You will confirm the payment on your phone with your PIN. Delta will never ask you for it.',
    ouCarte: 'Pay by international bank card instead',
    ouMobile: 'Pay by mobile money instead',
    titreCarte: 'Pay by international bank card',
    carteDetail: 'Visa, Mastercard, American Express',
    payerCarte: (montant: string) => `Pay ${montant} by card`,
    carteSeulement:
      'This order is in a foreign currency: it is paid by international bank card. Mobile money only works in Ariary.',
    titreAttente: 'Confirm the payment on your phone',
    demandeEnvoyee: (montant: string, numero: string, nom: string) =>
      `A request for ${montant} was sent to ${numero} (${nom}). Enter your PIN to confirm.`,
    enAttenteDe: (nom: string) => `Waiting for ${nom} confirmation…`,
    etapes: [
      'A notification or message appears on your phone.',
      'Check the amount, then enter your PIN.',
      'The confirmation appears here automatically.',
    ],
    rienRecu: 'I received nothing — change number',
    delaiDepasse:
      'No confirmation received yet. If you confirmed, it will arrive shortly; otherwise, start again.',
    recommencer: 'Start again',
    attenteCarte: 'Card payment being processed…',
    simuler: 'Simulate the operator confirmation (development)',
    reussi: 'Payment received — your order is confirmed.',
    merci: 'Thank you! We are preparing your order.',
    reussiAcompte: 'Deposit received — your booking is confirmed.',
    merciAcompte: 'Thank you! The balance is paid on site.',
    echoue: 'The payment did not go through.',
    echoueDetail: 'No amount was debited. Check your balance, then try again.',
    reessayer: 'Try again',
  },
};
