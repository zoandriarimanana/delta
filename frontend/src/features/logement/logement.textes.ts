/** Textes du module logement (parcours public) — une version par langue. */

import type { Textes } from '@/lib/langue';

import type { StatutLogement } from './logement.types';

const fr = {
  nosHebergements: 'Nos hébergements',
  sousTitre: 'Chambres disponibles à la nuitée, sur place',
  capaciteMin: 'Capacité minimale',
  personnesPlaceholder: 'Personnes',
  chargement: '⏳ Chargement des hébergements…',
  aucun: 'Aucun hébergement ne correspond à cette capacité.',
  voirTous: 'Voir tous les hébergements',
  chambre: (type: string) => `Chambre ${type}`,
  personnes: (n: number) => `${n} personne(s)`,
  parNuit: (montant: string) => `${montant} / nuit`,
  erreurChargement: 'Le chargement a échoué. Réessayez dans un instant.',
  retour: 'Retour aux hébergements',
  introuvable: 'Cet hébergement est introuvable.',
  chargementCourt: 'Chargement…',
  description: 'Description',
  descriptionParDefaut: (type: string, capacite: number) =>
    `Chambre ${type} pour ${capacite} personne(s). Aucune présentation détaillée n’a encore été rédigée pour ce logement.`,
  reserver: 'Réserver ce logement',
  hebergement: 'Hébergement',
  statutsLogement: 'Statuts du logement',
  jusqua: (n: number) => `Jusqu’à ${n} personne(s)`,
  statut: (libelle: string) => `Statut : ${libelle}`,
  typeChambre: 'Type de chambre',
  capacite: 'Capacité',
  tarif: 'Tarif',
  tarifParNuit: (montant: string) => `${montant} par nuit`,
  statuts: {
    Disponible: 'Disponible à la réservation',
    En_maintenance: 'Temporairement indisponible',
    Hors_service: 'Retiré de l’offre',
  } satisfies Record<StatutLogement, string>,
  etatIndisponible: 'État indisponible',
  explications: {
    Disponible:
      'Ce logement est ouvert à la réservation. Choisissez vos dates ci-dessous : si la période est libre, votre demande est enregistrée aussitôt et apparaît dans « Mes réservations ». Il peut aussi vous être attribué en complément d’une formation qui propose l’hébergement.',
    En_maintenance:
      'Ce logement fait actuellement l’objet d’un entretien ou de travaux et ne peut pas être réservé pour le moment. Il reviendra dans l’offre dès la fin de l’intervention : revenez consulter cette page prochainement, ou découvrez nos autres hébergements.',
    Hors_service:
      'Ce logement a été retiré de notre offre et n’accepte plus de réservation. Nos autres hébergements restent à votre disposition.',
  } satisfies Record<StatutLogement, string>,
  explicationInconnue:
    'L’état de ce logement n’est pas disponible pour le moment. Contactez-nous pour en savoir plus.',
};

export const TEXTES_LOGEMENT: Textes<typeof fr> = {
  fr,
  en: {
    nosHebergements: 'Our accommodation',
    sousTitre: 'Rooms available by the night, on site',
    capaciteMin: 'Minimum capacity',
    personnesPlaceholder: 'People',
    chargement: '⏳ Loading accommodation…',
    aucun: 'No accommodation matches this capacity.',
    voirTous: 'See all accommodation',
    chambre: (type: string) => `${type} room`,
    personnes: (n: number) => `${n} people`,
    parNuit: (montant: string) => `${montant} / night`,
    erreurChargement: 'Loading failed. Please try again shortly.',
    retour: 'Back to accommodation',
    introuvable: 'This accommodation cannot be found.',
    chargementCourt: 'Loading…',
    description: 'Description',
    descriptionParDefaut: (type: string, capacite: number) =>
      `${type} room for ${capacite} people. No detailed description has been written for this room yet.`,
    reserver: 'Book this room',
    hebergement: 'Accommodation',
    statutsLogement: 'Room status',
    jusqua: (n: number) => `Up to ${n} people`,
    statut: (libelle: string) => `Status: ${libelle}`,
    typeChambre: 'Room type',
    capacite: 'Capacity',
    tarif: 'Price',
    tarifParNuit: (montant: string) => `${montant} per night`,
    statuts: {
      Disponible: 'Available for booking',
      En_maintenance: 'Temporarily unavailable',
      Hors_service: 'No longer offered',
    },
    etatIndisponible: 'Status unavailable',
    explications: {
      Disponible:
        'This room is open for booking. Choose your dates below: if the period is free, your request is recorded immediately and appears in “My bookings”. It may also be assigned to you alongside a training course that offers accommodation.',
      En_maintenance:
        'This room is currently undergoing maintenance or work and cannot be booked for now. It will return once the work is finished: check this page again soon, or discover our other rooms.',
      Hors_service:
        'This room has been withdrawn from our offer and no longer accepts bookings. Our other rooms remain available to you.',
    },
    explicationInconnue:
      'The status of this room is not available at the moment. Contact us to find out more.',
  },
};
