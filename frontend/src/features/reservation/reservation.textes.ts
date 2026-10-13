/** Textes du module réservation (parcours client) — une version par langue. */

import type { Textes } from '@/lib/langue';

import type { StatutReservation, TypeReservation } from './reservation.types';

const fr = {
  statuts: {
    En_attente: 'En attente de confirmation',
    Confirmee: 'Confirmée',
    Honoree: 'Honorée',
    Annulee: 'Annulée',
  } satisfies Record<StatutReservation, string>,
  statutIndisponible: 'Statut indisponible',
  placeLiberee: (libelle: string) => `${libelle} — votre place a été libérée`,
  types: {
    Formation: 'Formation',
    Salle: 'Salle',
    Logement: 'Hébergement',
    Table: 'Table',
  } satisfies Record<TypeReservation, string>,
  sessionNumero: (n: number) => `Session de formation n° ${n}`,
  salleNumero: (n: number) => `Salle n° ${n}`,
  hebergementNumero: (n: number) => `Hébergement n° ${n}`,
  chambre: (type: string) => `Chambre ${type}`,
  erreurEnregistrement:
    'La réservation n’a pas pu être enregistrée. Réessayez dans un instant.',
  // Formulaires
  connectezVous: 'Connectez-vous',
  pourReserverSession: 'pour réserver cette session.',
  pourReserver: 'pour réserver.',
  enregistree: (n: number) =>
    `Réservation enregistrée pour ${n} personne(s). Retrouvez-la dans`,
  vosReservations: 'vos réservations',
  // Acompte (13 octobre 2026)
  acompteAPayer: (montant: string) => `Acompte à payer : ${montant}`,
  acompteDetail: (total: string) =>
    `30 % du prix total (${total}) pour retenir votre réservation ; le solde se règle sur place.`,
  acompteAvant: (date: string) =>
    `À payer avant le ${date} — sans acompte, la réservation est annulée.`,
  payerAcompte: 'Payer l’acompte',
  nombrePersonnes: 'Nombre de personnes',
  souhaiteHebergement: 'Je souhaite être hébergé pendant la formation',
  envoi: 'Envoi…',
  reserver: 'Réserver',
  nonReservable: 'Ce logement n’est pas réservable pour le moment.',
  debut: 'Début',
  fin: 'Fin',
  // Mes réservations
  mesReservations: 'Mes réservations',
  connectezVousReservations: 'Connectez-vous pour retrouver vos réservations.',
  seConnecter: 'Se connecter',
  sousTitre: 'Vos formations, salles et hébergements réservés chez Delta.',
  chargement: 'Chargement…',
  nonChargees: 'Vos réservations n’ont pas pu être chargées.',
  annulationEchouee: 'L’annulation a échoué. Réessayez dans un instant.',
  rubriques: 'Rubriques de réservations',
  onglets: {
    a_venir: {
      libelle: 'À venir',
      vide: 'Aucune réservation à venir. Réservez une formation, une salle ou un hébergement.',
    },
    passee: { libelle: 'Passées', vide: 'Aucune réservation passée pour l’instant.' },
    annulee: { libelle: 'Annulées', vide: 'Aucune réservation annulée.' },
  },
  formations: 'Formations',
  salles: 'Salles',
  hebergements: 'Hébergements',
  // Carte
  reservationNumero: (n: number) => `Réservation n° ${n}`,
  du: 'Du',
  au: 'au',
  personnes: (n: number) => `${n} personne(s)`,
  hebergementAttribue: 'Hébergement attribué pour la durée de la formation',
  hebergementDemande: 'Hébergement demandé — aucune chambre libre pour l’instant',
  annulerReservation: 'Annuler la réservation',
  confirmerAnnulation: 'Confirmer l’annulation',
  liberePlace: 'Annuler libère votre place, et l’hébergement lié s’il y en a un.',
  libereCreneau: 'Annuler libère ce créneau.',
  annulation: 'Annulation…',
  garder: 'Garder',
  deposerAvis: 'Déposer un avis',
};

export const TEXTES_RESERVATION: Textes<typeof fr> = {
  fr,
  en: {
    statuts: {
      En_attente: 'Awaiting confirmation',
      Confirmee: 'Confirmed',
      Honoree: 'Completed',
      Annulee: 'Cancelled',
    },
    statutIndisponible: 'Status unavailable',
    placeLiberee: (libelle: string) => `${libelle} — your place has been released`,
    types: {
      Formation: 'Training',
      Salle: 'Room',
      Logement: 'Accommodation',
      Table: 'Table',
    },
    sessionNumero: (n: number) => `Training session no. ${n}`,
    salleNumero: (n: number) => `Room no. ${n}`,
    hebergementNumero: (n: number) => `Accommodation no. ${n}`,
    chambre: (type: string) => `${type} room`,
    erreurEnregistrement:
      'Your booking could not be recorded. Please try again shortly.',
    connectezVous: 'Sign in',
    pourReserverSession: 'to book this session.',
    pourReserver: 'to book.',
    enregistree: (n: number) => `Booking recorded for ${n} people. Find it in`,
    acompteAPayer: (montant: string) => `Deposit to pay: ${montant}`,
    acompteDetail: (total: string) =>
      `30% of the total price (${total}) to hold your booking; the balance is paid on site.`,
    acompteAvant: (date: string) =>
      `Pay before ${date} — without a deposit, the booking is cancelled.`,
    payerAcompte: 'Pay the deposit',
    vosReservations: 'your bookings',
    nombrePersonnes: 'Number of people',
    souhaiteHebergement: 'I would like accommodation during the training',
    envoi: 'Sending…',
    reserver: 'Book',
    nonReservable: 'This room cannot be booked at the moment.',
    debut: 'Start',
    fin: 'End',
    mesReservations: 'My bookings',
    connectezVousReservations: 'Sign in to see your bookings.',
    seConnecter: 'Sign in',
    sousTitre: 'Your training, rooms and accommodation booked with Delta.',
    chargement: 'Loading…',
    nonChargees: 'Your bookings could not be loaded.',
    annulationEchouee: 'Cancellation failed. Please try again shortly.',
    rubriques: 'Booking sections',
    onglets: {
      a_venir: {
        libelle: 'Upcoming',
        vide: 'No upcoming bookings. Book a training course, a room or accommodation.',
      },
      passee: { libelle: 'Past', vide: 'No past bookings yet.' },
      annulee: { libelle: 'Cancelled', vide: 'No cancelled bookings.' },
    },
    formations: 'Training',
    salles: 'Rooms',
    hebergements: 'Accommodation',
    reservationNumero: (n: number) => `Booking no. ${n}`,
    du: 'From',
    au: 'to',
    personnes: (n: number) => `${n} people`,
    hebergementAttribue: 'Accommodation assigned for the duration of the training',
    hebergementDemande: 'Accommodation requested — no room available yet',
    annulerReservation: 'Cancel booking',
    confirmerAnnulation: 'Confirm cancellation',
    liberePlace: 'Cancelling releases your place, and the linked accommodation if any.',
    libereCreneau: 'Cancelling releases this time slot.',
    annulation: 'Cancelling…',
    garder: 'Keep',
    deposerAvis: 'Leave a review',
  },
};
