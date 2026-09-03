/** Règles d'affichage des logements — fonctions pures. */

import type { VarianteBadge } from '@/components/ui/Badge';

import type { Logement, StatutLogement } from './logement.types';

const LIBELLES: Record<StatutLogement, string> = {
  Disponible: 'Disponible à la réservation',
  // Le client n'a pas à connaître le détail : ce qui l'intéresse est de savoir
  // qu'il ne peut pas réserver, et si cela peut changer.
  En_maintenance: 'Temporairement indisponible',
  Hors_service: 'Retiré de l’offre',
};

/**
 * Traduit un statut en libellé lisible.
 *
 * Un statut inconnu — API en avance sur le frontend — retombe sur un libellé
 * neutre plutôt que sur un identifiant technique brut.
 */
export function libelleStatut(statut: StatutLogement): string {
  return LIBELLES[statut] ?? 'État indisponible';
}

/**
 * Indique si un logement peut être réservé.
 *
 * **Ne dit rien de sa disponibilité à une date donnée** : le serveur refuse en
 * 409 si le créneau est déjà pris. Ceci évite un aller-retour inutile sur un
 * bien qui n'est de toute façon pas louable, ce n'est pas la garantie.
 */
export function estReservable(logement: Logement): boolean {
  return logement.statut === 'Disponible';
}

const VARIANTES: Record<StatutLogement, VarianteBadge> = {
  Disponible: 'positif',
  En_maintenance: 'attente',
  Hors_service: 'negatif',
};

/**
 * Variante visuelle correspondant à l'état du bien.
 *
 * **C'est le module qui choisit**, pas la pastille. `Badge` ne connaît aucune
 * entité : lui faire porter cette table reviendrait à y rassembler les statuts
 * de quatre entités, ce que la SRP interdit — et ce que la version d'origine
 * faisait.
 *
 * `En_maintenance` est en attente et non en négatif : le bien revient. C'est
 * exactement la distinction que `Hors_service` ne porte pas, et l'afficher
 * autrement effacerait la seule information utile au moment de planifier.
 *
 * Un statut inconnu retombe sur `neutre`, comme `libelleStatut` retombe sur un
 * libellé neutre.
 */
export function varianteStatut(statut: StatutLogement): VarianteBadge {
  return VARIANTES[statut] ?? 'neutre';
}
