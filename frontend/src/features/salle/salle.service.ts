/** Règles d'affichage des salles — fonctions pures. */

import { formaterMontant } from '@/features/commande/commande.service';
import { textesCourants } from '@/lib/langue';

import { TEXTES_SALLE } from './salle.textes';
import type { Salle } from './salle.types';

/**
 * Décrit la tarification d'une salle en une phrase.
 *
 * Une salle porte **au moins un** tarif — le `CHECK` de #45 le garantit — mais
 * pas forcément les deux. Le cas « aucun des deux » n'est donc pas
 * représentable ; s'il se présentait, il viendrait d'une API en désaccord avec
 * son propre schéma, et le libellé neutre vaut mieux qu'une chaîne vide.
 */
export function libelleTarif(
  salle: Salle,
  formater: (montant: string) => string = formaterMontant
): string {
  const t = textesCourants(TEXTES_SALLE);
  const parties: string[] = [];
  if (salle.tarif_horaire !== null) {
    parties.push(t.parHeure(formater(salle.tarif_horaire)));
  }
  if (salle.tarif_journee !== null) {
    parties.push(t.parJournee(formater(salle.tarif_journee)));
  }
  return parties.length > 0 ? parties.join(' — ') : t.tarifNonCommunique;
}

/**
 * Explication détaillée des conditions de location, pour la fiche publique.
 *
 * `SALLE` ne porte **aucun statut** — contrairement à `LOGEMENT` — : une salle
 * active est toujours louable, seul son calendrier décide, et il ne se lit
 * qu'à la réservation. Ce texte ne prétend donc rien sur une date donnée.
 */
export function explicationLocation(salle: Salle): string {
  const t = textesCourants(TEXTES_SALLE);
  const heure = salle.tarif_horaire !== null;
  const journee = salle.tarif_journee !== null;
  const location =
    heure && journee
      ? t.locationDeux
      : heure
        ? t.locationHeure
        : journee
          ? t.locationJournee
          : t.locationAucune;
  return t.explication(salle.capacite, location);
}

/** Modes de location, en pastilles : « À l’heure », « À la journée ». */
export function modesLocation(salle: Salle): string[] {
  const modes: string[] = [];
  const t = textesCourants(TEXTES_SALLE);
  if (salle.tarif_horaire !== null) modes.push(t.aLHeure);
  if (salle.tarif_journee !== null) modes.push(t.aLaJournee);
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
