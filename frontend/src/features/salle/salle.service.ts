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

/**
 * Explication détaillée des conditions de location, pour la fiche publique.
 *
 * `SALLE` ne porte **aucun statut** — contrairement à `LOGEMENT` — : une salle
 * active est toujours louable, seul son calendrier décide, et il ne se lit
 * qu'à la réservation. Ce texte ne prétend donc rien sur une date donnée.
 */
export function explicationLocation(salle: Salle): string {
  const modes: string[] = [];
  if (salle.tarif_horaire !== null) modes.push('à l’heure');
  if (salle.tarif_journee !== null) modes.push('à la journée');
  const location =
    modes.length === 2
      ? 'Elle se loue à l’heure ou à la journée, selon la durée de votre événement.'
      : modes.length === 1
        ? `Elle se loue ${modes[0]}.`
        : 'Contactez-nous pour connaître ses conditions de location.';
  return (
    `Cette salle accueille jusqu’à ${salle.capacite} personne(s). ${location} ` +
    'Choisissez votre créneau ci-dessous : s’il est libre, votre demande est ' +
    'enregistrée aussitôt et apparaît dans « Mes réservations ». Un créneau ' +
    'déjà réservé vous sera signalé avant toute confirmation.'
  );
}

/** Modes de location, en pastilles : « À l’heure », « À la journée ». */
export function modesLocation(salle: Salle): string[] {
  const modes: string[] = [];
  if (salle.tarif_horaire !== null) modes.push('À l’heure');
  if (salle.tarif_journee !== null) modes.push('À la journée');
  return modes;
}

/**
 * Équipements découpés en éléments, pour un affichage en pastilles.
 *
 * `equipements` est un texte libre : on découpe sur les virgules, points-virgules
 * et retours à la ligne, ce que la saisie courante utilise. Un texte sans
 * séparateur reste un seul élément — rien n'est perdu, seulement moins découpé.
 */
export function listeEquipements(salle: Salle): string[] {
  return (salle.equipements ?? '')
    .split(/[,;\n]/)
    .map((element) => element.trim())
    .filter((element) => element.length > 0);
}
