/** Règles d'affichage des logements — fonctions pures. */

import type { VarianteBadge } from '@/components/ui/Badge';
import { textesCourants } from '@/lib/langue';

import { TEXTES_LOGEMENT } from './logement.textes';
import type { Logement, StatutLogement } from './logement.types';

/**
 * Traduit un statut en libellé lisible.
 *
 * Un statut inconnu — API en avance sur le frontend — retombe sur un libellé
 * neutre plutôt que sur un identifiant technique brut.
 */
export function libelleStatut(statut: StatutLogement): string {
  const t = textesCourants(TEXTES_LOGEMENT);
  return t.statuts[statut] ?? t.etatIndisponible;
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

/**
 * Explication détaillée du statut, pour la fiche publique.
 *
 * `libelleStatut` dit **l'état** en trois mots ; celle-ci dit au visiteur **ce
 * qu'il peut faire**. Comme le libellé, elle ne parle jamais d'occupation à une
 * date donnée : le statut décrit le bien, pas son calendrier.
 */
export function explicationStatut(statut: StatutLogement): string {
  const t = textesCourants(TEXTES_LOGEMENT);
  return t.explications[statut] ?? t.explicationInconnue;
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
