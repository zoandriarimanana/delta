/**
 * Règles d'affichage du suivi — fonctions pures, sans appel ni rendu.
 *
 * Les valeurs de `StatutLivraison` sont des identifiants techniques
 * (`En_attente`, `Echouee`) : lisibles dans une base, illisibles pour un client.
 * Les traduire est une règle métier, pas de la mise en forme — d'où sa place
 * ici et non dans le composant.
 */

import type { StatutLivraison } from './livraison.types';

/** Ce qu'un statut dit au client, et ce qu'il lui demande. */
export interface LibelleStatut {
  /** Titre court, affiché en tête. */
  titre: string;
  /** Une phrase qui répond à « et maintenant ? ». */
  explication: string;
  /**
   * Vrai quand le client n'a **rien** à faire et que quelqu'un s'en occupe.
   * Sert à choisir un ton rassurant plutôt qu'une alerte.
   */
  priseEnCharge: boolean;
}

const LIBELLES: Record<StatutLivraison, LibelleStatut> = {
  En_attente: {
    titre: 'En préparation',
    explication:
      'Votre commande est enregistrée. Elle partira dès qu’un livreur lui sera affecté.',
    priseEnCharge: true,
  },
  En_cours: {
    titre: 'En cours de livraison',
    explication: 'Votre commande est en route.',
    priseEnCharge: true,
  },
  Livree: {
    titre: 'Livrée',
    explication: 'Votre commande vous a été remise.',
    priseEnCharge: true,
  },
  Echouee: {
    // Le seul statut qui pourrait inquiéter, et le seul où le client risque de
    // croire qu'il doit agir. Il ne le doit pas : la suite — nouvelle tentative,
    // remboursement, annulation — est traitée par l'équipe. Le dire
    // explicitement évite un appel au support pour rien.
    titre: 'Livraison non aboutie',
    explication:
      'La livraison n’a pas pu être remise. Notre équipe reprend contact avec vous : vous n’avez aucune démarche à faire.',
    priseEnCharge: true,
  },
  Annulee: {
    titre: 'Livraison annulée',
    explication: 'Cette livraison n’aura pas lieu.',
    priseEnCharge: false,
  },
};

/**
 * Traduit un statut en libellé lisible.
 *
 * Un statut inconnu — API en avance sur le frontend — retombe sur un libellé
 * neutre plutôt que sur une page vide ou un identifiant technique brut. Le
 * `Record` typé rend le cas impossible tant que les deux restent synchronisés ;
 * la garde couvre le déploiement décalé.
 */
export function libelleStatut(statut: StatutLivraison): LibelleStatut {
  return (
    LIBELLES[statut] ?? {
      titre: 'Suivi indisponible',
      explication: 'L’état de cette livraison n’a pas pu être déterminé.',
      priseEnCharge: false,
    }
  );
}

/** Ordre d'avancement, pour situer le statut courant dans le parcours. */
export const ETAPES: readonly StatutLivraison[] = [
  'En_attente',
  'En_cours',
  'Livree',
] as const;

/**
 * Indique si le statut fait partie du parcours nominal.
 *
 * `Echouee` et `Annulee` en sortent : les afficher comme une étape parmi
 * d'autres suggérerait que le parcours continue, alors qu'il s'est arrêté.
 */
export function estParcoursNominal(statut: StatutLivraison): boolean {
  return ETAPES.includes(statut);
}
