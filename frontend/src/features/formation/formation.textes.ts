/** Textes du module formation (parcours public) — une version par langue. */

import type { Textes } from '@/lib/langue';

const fr = {
  // Liste
  nosFormations: 'Nos formations',
  sousTitre: 'Découvrez nos ateliers et sessions de formation culinaire',
  filtrerDomaine: 'Filtrer par domaine:',
  tousDomaines: 'Tous les domaines',
  chargementFormations: '⏳ Chargement des formations…',
  aucuneFormation: 'Aucune formation ne correspond à votre recherche.',
  voirToutes: 'Voir toutes les formations',
  hebergement: '🏨 Hébergement',
  niveau: (n: string) => `Niveau ${n}`,
  erreurChargement: 'Le chargement a échoué. Réessayez dans un instant.',
  // Fiche
  retour: 'Retour aux formations',
  introuvable: 'Cette formation est introuvable.',
  chargement: 'Chargement…',
  description: 'Description',
  descriptionParDefaut: (duree: string, niveau: string | null, capacite: number) =>
    `Formation de ${duree}` +
    (niveau !== null ? `, niveau ${niveau}` : '') +
    `, en groupe de ${capacite} participant(s) au plus. ` +
    'Aucune présentation détaillée n’a encore été rédigée pour cette formation.',
  aProposDomaine: (libelle: string) => `À propos du domaine « ${libelle} » :`,
  sessionsInscriptions: 'Sessions et inscriptions',
  aucuneSession:
    'Aucune session n’est programmée pour le moment. Revenez prochainement : les nouvelles dates sont annoncées ici dès leur planification.',
  formation: 'Formation',
  parPersonne: 'par personne',
  statutsFormation: 'Statuts de la formation',
  sessionsOuvertes: (n: number) => `${n} session(s) ouverte(s)`,
  aucuneInscription: 'Aucune inscription ouverte',
  hebergementPossible: 'Hébergement possible',
  inscription: 'Inscription',
  placesDisponibles:
    'Des places sont disponibles. Choisissez votre session plus bas : votre place est retenue dès l’envoi de la demande.',
  aucuneSessionOuverte:
    'Aucune session n’accepte d’inscription pour le moment. Les prochaines dates apparaîtront plus bas dès leur ouverture.',
  avecHebergement:
    'Un hébergement sur place peut être demandé à la réservation : une chambre libre vous est alors attribuée pour les dates de la session.',
  sansHebergement: 'Cette formation ne comprend pas d’hébergement.',
  duree: 'Durée',
  niveauTerme: 'Niveau',
  tousNiveaux: 'Tous niveaux',
  groupe: 'Groupe',
  participantsMax: (n: number) => `${n} participant(s) au plus`,
  hebergementTerme: 'Hébergement',
  surDemande: 'Possible sur demande',
  nonInclus: 'Non inclus',
  // Session
  du: 'Du',
  au: 'au',
  placesRestantes: (n: number) => `${n} place(s) restante(s)`,
  animeePar: (nom: string) => `Animée par ${nom}`,
  complete: 'Session complète.',
  indisponible: 'Session indisponible.',
  raisons: {
    Planifiee: 'Inscriptions pas encore ouvertes.',
    Terminee: 'Session terminée.',
    Annulee: 'Session annulée.',
  } as Record<string, string>,
  inscriptionsOuvertes: 'Inscriptions ouvertes',
  completeCourt: 'Complète',
  indisponibleCourt: 'Indisponible',
  etats: {
    Planifiee: 'Bientôt ouverte',
    Terminee: 'Terminée',
    Annulee: 'Annulée',
  } as Record<string, string>,
  explicationOuverte:
    'Les inscriptions sont ouvertes. Indiquez le nombre de participants ci-dessous : votre place est retenue dès l’envoi de la demande, et apparaît aussitôt dans « Mes réservations ».',
  explicationComplete:
    'Toutes les places de cette session sont prises. Une place peut se libérer en cas d’annulation : revenez consulter cette page, ou choisissez une autre session.',
  explicationIndisponible: 'Cette session n’est pas disponible pour le moment.',
  explications: {
    Planifiee:
      'Cette session est programmée, mais ses inscriptions ne sont pas encore ouvertes. Revenez prochainement pour réserver votre place.',
    Terminee:
      'Cette session a eu lieu. Si vous y avez participé, vous pouvez déposer un avis depuis « Mes réservations ».',
    Annulee:
      'Cette session a été annulée et n’accepte plus d’inscription. Les places déjà réservées ont été libérées.',
  } as Record<string, string>,
};

export const TEXTES_FORMATION: Textes<typeof fr> = {
  fr,
  en: {
    nosFormations: 'Our training',
    sousTitre: 'Discover our culinary workshops and training sessions',
    filtrerDomaine: 'Filter by field:',
    tousDomaines: 'All fields',
    chargementFormations: '⏳ Loading training…',
    aucuneFormation: 'No training matches your search.',
    voirToutes: 'See all training',
    hebergement: '🏨 Accommodation',
    niveau: (n: string) => `Level ${n}`,
    erreurChargement: 'Loading failed. Please try again shortly.',
    retour: 'Back to training',
    introuvable: 'This training cannot be found.',
    chargement: 'Loading…',
    description: 'Description',
    descriptionParDefaut: (duree: string, niveau: string | null, capacite: number) =>
      `A ${duree} training course` +
      (niveau !== null ? `, level ${niveau}` : '') +
      `, in groups of up to ${capacite} participant(s). ` +
      'No detailed description has been written for this training yet.',
    aProposDomaine: (libelle: string) => `About the “${libelle}” field:`,
    sessionsInscriptions: 'Sessions and registration',
    aucuneSession:
      'No session is scheduled at the moment. Check back soon: new dates are announced here as soon as they are planned.',
    formation: 'Training',
    parPersonne: 'per person',
    statutsFormation: 'Training status',
    sessionsOuvertes: (n: number) => `${n} open session(s)`,
    aucuneInscription: 'Registration closed',
    hebergementPossible: 'Accommodation available',
    inscription: 'Registration',
    placesDisponibles:
      'Places are available. Choose your session below: your place is held as soon as you send your request.',
    aucuneSessionOuverte:
      'No session is open for registration at the moment. Upcoming dates will appear below as soon as they open.',
    avecHebergement:
      'On-site accommodation can be requested when booking: a free room is then assigned to you for the session dates.',
    sansHebergement: 'This training does not include accommodation.',
    duree: 'Duration',
    niveauTerme: 'Level',
    tousNiveaux: 'All levels',
    groupe: 'Group',
    participantsMax: (n: number) => `Up to ${n} participant(s)`,
    hebergementTerme: 'Accommodation',
    surDemande: 'Available on request',
    nonInclus: 'Not included',
    du: 'From',
    au: 'to',
    placesRestantes: (n: number) => `${n} place(s) left`,
    animeePar: (nom: string) => `Led by ${nom}`,
    complete: 'Session full.',
    indisponible: 'Session unavailable.',
    raisons: {
      Planifiee: 'Registration not open yet.',
      Terminee: 'Session over.',
      Annulee: 'Session cancelled.',
    },
    inscriptionsOuvertes: 'Registration open',
    completeCourt: 'Full',
    indisponibleCourt: 'Unavailable',
    etats: { Planifiee: 'Opening soon', Terminee: 'Over', Annulee: 'Cancelled' },
    explicationOuverte:
      'Registration is open. Enter the number of participants below: your place is held as soon as you send your request, and appears straight away in “My bookings”.',
    explicationComplete:
      'All places for this session are taken. A place may become free if someone cancels: check this page again, or choose another session.',
    explicationIndisponible: 'This session is not available at the moment.',
    explications: {
      Planifiee:
        'This session is scheduled, but registration is not open yet. Check back soon to book your place.',
      Terminee:
        'This session has taken place. If you attended, you can leave a review from “My bookings”.',
      Annulee:
        'This session has been cancelled and no longer accepts registrations. Places already booked have been released.',
    },
  },
};
