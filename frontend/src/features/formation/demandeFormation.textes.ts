/** Textes publics de la formation sur commande — une version par langue. */

import type { Textes } from '@/lib/langue';

const fr = {
  titre: 'Vous ne trouvez pas votre formation ?',
  accroche:
    'Delta monte des formations sur mesure, chez nous ou dans votre entreprise. Décrivez votre besoin, le responsable des formations vous recontacte.',
  appeler: (numero: string) => `Ou appelez le responsable des formations : ${numero}`,
  ouvrir: 'Demander une formation sur mesure',
  sujet: 'Formation souhaitée',
  exempleSujet: 'Ex. décoration de gâteaux en pâte à sucre',
  participants: 'Nombre de participants',
  niveau: 'Niveau des participants (facultatif)',
  exempleNiveau: 'Ex. débutants, professionnels',
  periode: 'Période souhaitée (facultatif)',
  exemplePeriode: 'Ex. novembre, en semaine',
  lieu: 'Lieu',
  lieux: {
    Indifferent: 'Peu importe',
    Chez_delta: 'Chez Delta',
    En_entreprise: 'Dans notre entreprise',
  },
  message: 'Précisions (facultatif)',
  nom: 'Votre nom',
  contact: 'Téléphone ou e-mail',
  envoyer: 'Envoyer ma demande',
  envoi: 'Envoi…',
  fermer: 'Fermer',
  merci:
    'Demande envoyée, merci ! Le responsable des formations vous recontacte rapidement.',
  erreur: 'La demande n’a pas pu être envoyée. Vérifiez les champs, puis réessayez.',
  tropDeDemandes: 'Trop de demandes en peu de temps. Réessayez dans une minute.',
};

export const TEXTES_DEMANDE_FORMATION: Textes<typeof fr> = {
  fr,
  en: {
    titre: 'Can’t find the training you need?',
    accroche:
      'Delta designs custom training, at our place or at your company. Describe your need and the training manager will contact you.',
    appeler: (numero: string) => `Or call the training manager: ${numero}`,
    ouvrir: 'Request custom training',
    sujet: 'Training wanted',
    exempleSujet: 'E.g. sugar paste cake decoration',
    participants: 'Number of participants',
    niveau: 'Participants’ level (optional)',
    exempleNiveau: 'E.g. beginners, professionals',
    periode: 'Preferred period (optional)',
    exemplePeriode: 'E.g. November, on weekdays',
    lieu: 'Location',
    lieux: {
      Indifferent: 'Either',
      Chez_delta: 'At Delta',
      En_entreprise: 'At our company',
    },
    message: 'Details (optional)',
    nom: 'Your name',
    contact: 'Phone or e-mail',
    envoyer: 'Send my request',
    envoi: 'Sending…',
    fermer: 'Close',
    merci: 'Request sent, thank you! The training manager will contact you shortly.',
    erreur: 'The request could not be sent. Check the fields, then try again.',
    tropDeDemandes: 'Too many requests in a short time. Try again in a minute.',
  },
};
