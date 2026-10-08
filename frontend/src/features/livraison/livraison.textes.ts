/** Textes du suivi de livraison (parcours client) — une version par langue. */

import type { Textes } from '@/lib/langue';

import type { StatutLivraison } from './livraison.types';

type Libelle = { titre: string; explication: string };

const fr = {
  statuts: {
    En_attente: {
      titre: 'En préparation',
      explication:
        'Votre commande est enregistrée. Elle partira dès qu’un livreur lui sera affecté.',
    },
    En_cours: {
      titre: 'En cours de livraison',
      explication: 'Votre commande est en route.',
    },
    Livree: { titre: 'Livrée', explication: 'Votre commande vous a été remise.' },
    Echouee: {
      titre: 'Livraison non aboutie',
      explication:
        'La livraison n’a pas pu être remise. Notre équipe reprend contact avec vous : vous n’avez aucune démarche à faire.',
    },
    Annulee: {
      titre: 'Livraison annulée',
      explication: 'Cette livraison n’aura pas lieu.',
    },
  } satisfies Record<StatutLivraison, Libelle>,
  inconnu: {
    titre: 'Suivi indisponible',
    explication: 'L’état de cette livraison n’a pas pu être déterminé.',
  } as Libelle,
  suivi: 'Suivi de livraison',
  livraison: (titre: string) => `Livraison — ${titre}`,
  prevueLe: 'Prévue le',
  remiseLe: 'Remise le',
  repasserCommande: 'Contactez-nous si vous souhaitez repasser commande.',
  erreurChargement: 'Le suivi de livraison n’a pas pu être chargé.',
};

export const TEXTES_LIVRAISON: Textes<typeof fr> = {
  fr,
  en: {
    statuts: {
      En_attente: {
        titre: 'Being prepared',
        explication:
          'Your order is recorded. It will leave as soon as a courier is assigned.',
      },
      En_cours: { titre: 'Out for delivery', explication: 'Your order is on its way.' },
      Livree: {
        titre: 'Delivered',
        explication: 'Your order has been handed over to you.',
      },
      Echouee: {
        titre: 'Delivery unsuccessful',
        explication:
          'The delivery could not be completed. Our team will get back to you: there is nothing you need to do.',
      },
      Annulee: {
        titre: 'Delivery cancelled',
        explication: 'This delivery will not take place.',
      },
    },
    inconnu: {
      titre: 'Tracking unavailable',
      explication: 'The status of this delivery could not be determined.',
    },
    suivi: 'Delivery tracking',
    livraison: (titre: string) => `Delivery — ${titre}`,
    prevueLe: 'Scheduled for',
    remiseLe: 'Delivered on',
    repasserCommande: 'Contact us if you would like to order again.',
    erreurChargement: 'Delivery tracking could not be loaded.',
  },
};
