/** Règles d'affichage des salles — fonctions pures. */

import { formaterMontant } from '@/features/commande/commande.service';

import type { Salle } from './salle.types';

/**
 * Décrit la tarification d'une salle en une phrase.
 *
 * Une salle porte **au moins un** tarif — le `CHECK` de #45 le garantit — mais
 * pas forcément les deux. Le cas « aucun des deux » n'est donc pas
 * représentable ; s'il se présentait, il viendrait d'une API en désaccord avec
 * son propre schéma, et le libellé neutre vaut mieux qu'une chaîne vide.
 */
export function libelleTarif(salle: Salle): string {
  const parties: string[] = [];
  if (salle.tarif_horaire !== null) {
    parties.push(`${formaterMontant(salle.tarif_horaire)} / heure`);
  }
  if (salle.tarif_journee !== null) {
    parties.push(`${formaterMontant(salle.tarif_journee)} / journée`);
  }
  return parties.length > 0 ? parties.join(' — ') : 'Tarif non communiqué';
}
