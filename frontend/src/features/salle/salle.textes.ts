/** Textes du module salle (parcours public) — une version par langue. */

import type { Textes } from '@/lib/langue';

const fr = {
  nosSalles: 'Nos salles',
  sousTitre: 'Espaces de réunion, de formation et de réception',
  capaciteMin: 'Capacité minimale',
  personnesPlaceholder: 'Personnes',
  chargementSalles: '⏳ Chargement des salles…',
  aucuneSalle: 'Aucune salle ne correspond à cette capacité.',
  voirToutes: 'Voir toutes les salles',
  personnes: (n: number) => `${n} personne(s)`,
  erreurChargement: 'Le chargement a échoué. Réessayez dans un instant.',
  retour: 'Retour aux salles',
  introuvable: 'Cette salle est introuvable.',
  chargement: 'Chargement…',
  description: 'Description',
  descriptionParDefaut: (nom: string, capacite: number) =>
    `${nom} peut accueillir jusqu’à ${capacite} personne(s). Aucune présentation détaillée n’a encore été rédigée pour ce lieu.`,
  reserver: 'Réserver cette salle',
  aLouer: 'Salle à louer',
  statutsSalle: 'Statuts de la salle',
  reservable: 'Réservable',
  jusqua: (n: number) => `Jusqu’à ${n} personne(s)`,
  conditions: 'Conditions de location',
  equipements: 'Équipements',
  aucunEquipement: 'Aucun équipement particulier n’est renseigné.',
  parHeure: (montant: string) => `${montant} / heure`,
  parJournee: (montant: string) => `${montant} / journée`,
  tarifNonCommunique: 'Tarif non communiqué',
  aLHeure: 'À l’heure',
  aLaJournee: 'À la journée',
  locationDeux:
    'Elle se loue à l’heure ou à la journée, selon la durée de votre événement.',
  locationHeure: 'Elle se loue à l’heure.',
  locationJournee: 'Elle se loue à la journée.',
  locationAucune: 'Contactez-nous pour connaître ses conditions de location.',
  explication: (capacite: number, location: string) =>
    `Cette salle accueille jusqu’à ${capacite} personne(s). ${location} ` +
    'Choisissez votre créneau ci-dessous : s’il est libre, votre demande est enregistrée aussitôt et apparaît dans « Mes réservations ». Un créneau déjà réservé vous sera signalé avant toute confirmation.',
};

export const TEXTES_SALLE: Textes<typeof fr> = {
  fr,
  en: {
    nosSalles: 'Our rooms',
    sousTitre: 'Spaces for meetings, training and receptions',
    capaciteMin: 'Minimum capacity',
    personnesPlaceholder: 'People',
    chargementSalles: '⏳ Loading rooms…',
    aucuneSalle: 'No room matches this capacity.',
    voirToutes: 'See all rooms',
    personnes: (n: number) => `${n} people`,
    erreurChargement: 'Loading failed. Please try again shortly.',
    retour: 'Back to rooms',
    introuvable: 'This room cannot be found.',
    chargement: 'Loading…',
    description: 'Description',
    descriptionParDefaut: (nom: string, capacite: number) =>
      `${nom} can host up to ${capacite} people. No detailed description has been written for this venue yet.`,
    reserver: 'Book this room',
    aLouer: 'Room for hire',
    statutsSalle: 'Room status',
    reservable: 'Bookable',
    jusqua: (n: number) => `Up to ${n} people`,
    conditions: 'Hire conditions',
    equipements: 'Equipment',
    aucunEquipement: 'No specific equipment listed.',
    parHeure: (montant: string) => `${montant} / hour`,
    parJournee: (montant: string) => `${montant} / day`,
    tarifNonCommunique: 'Price on request',
    aLHeure: 'By the hour',
    aLaJournee: 'By the day',
    locationDeux:
      'It can be hired by the hour or by the day, depending on the length of your event.',
    locationHeure: 'It is hired by the hour.',
    locationJournee: 'It is hired by the day.',
    locationAucune: 'Contact us for its hire conditions.',
    explication: (capacite: number, location: string) =>
      `This room hosts up to ${capacite} people. ${location} ` +
      'Choose your time slot below: if it is free, your request is recorded immediately and appears in “My bookings”. A slot that is already booked will be flagged before any confirmation.',
  },
};
