/** Textes des pages transverses (accueil, 404) — une version par langue. */

import type { Textes } from '@/lib/langue';

const fr = {
  bienvenue: 'Bienvenue chez Delta',
  accroche:
    'Plateforme artisanale pour la pâtisserie, restauration, formation culinaire et hébergement.',
  devise: 'Qualité, tradition et professionnalisme',
  surtitre: 'Pâtisserie · Boulangerie · Formations · Hébergement',
  commanderProduits: 'Commander nos produits',
  voirFormations: 'Découvrir les formations',
  atouts: [
    'Fait maison chaque jour',
    'Paiement MVola, Orange Money, Airtel Money',
    'Livraison à domicile',
  ],
  produits: 'Produits',
  produitsDescription: 'Pâtisserie, boulangerie, confiture et spécialités',
  formations: 'Formations',
  formationsDescription: 'Ateliers et sessions de formation culinaire',
  salles: 'Salles',
  sallesDescription: 'Location d’espaces pour vos réunions et événements',
  hebergement: 'Hébergement',
  hebergementDescription: 'Chambres confortables pour vos séjours',
  panier: 'Panier',
  panierDescription: 'Passez votre commande en ligne',
  monCompte: 'Mon compte',
  compteVisiteur: 'Connectez-vous pour gérer vos réservations',
  compteClient: 'Retrouvez vos commandes et vos réservations',
  decouvrir: 'Découvrez notre offre',
  decouvrirTexte:
    'Explorez notre catalogue de produits, formations et services. Tous les détails vous attendent.',
  explorer: 'Commencer à explorer',
  decouvrirCarte: 'Découvrir',
  introuvable: 'Cette page n’existe pas.',
  retourAccueil: 'Retour à l’accueil',
};

export const TEXTES_PAGES: Textes<typeof fr> = {
  fr,
  en: {
    bienvenue: 'Welcome to Delta',
    accroche:
      'An artisan platform for pastry, catering, culinary training and accommodation.',
    devise: 'Quality, tradition and professionalism',
    surtitre: 'Pastry · Bakery · Training · Accommodation',
    commanderProduits: 'Order our products',
    voirFormations: 'Discover our training',
    atouts: [
      'Homemade every day',
      'Pay with MVola, Orange Money, Airtel Money',
      'Home delivery',
    ],
    produits: 'Products',
    produitsDescription: 'Pastries, bread, jams and specialities',
    formations: 'Training',
    formationsDescription: 'Culinary workshops and training sessions',
    salles: 'Rooms',
    sallesDescription: 'Venue hire for your meetings and events',
    hebergement: 'Accommodation',
    hebergementDescription: 'Comfortable rooms for your stay',
    panier: 'Cart',
    panierDescription: 'Place your order online',
    monCompte: 'My account',
    compteVisiteur: 'Sign in to manage your bookings',
    compteClient: 'Find your orders and bookings',
    decouvrir: 'Discover what we offer',
    decouvrirTexte:
      'Browse our catalogue of products, training and services. Every detail is waiting for you.',
    explorer: 'Start exploring',
    decouvrirCarte: 'Explore',
    introuvable: 'This page does not exist.',
    retourAccueil: 'Back to home',
  },
};
