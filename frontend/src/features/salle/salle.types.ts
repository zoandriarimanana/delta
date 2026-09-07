/**
 * Types du module salle, relevés du schéma OpenAPI.
 *
 * Les tarifs arrivent en **chaîne** : ce sont des `Decimal` côté serveur, que
 * FastAPI sérialise ainsi pour ne pas perdre de précision au passage par le
 * flottant JSON. Même convention que les autres modules.
 */

export interface Salle {
  id_salle: number;
  nom: string;
  capacite: number;
  /**
   * `null` si la salle n'est louée qu'à la journée. Les deux ne peuvent pas
   * être nuls ensemble : un `CHECK` en base l'interdit (#45).
   */
  tarif_horaire: string | null;
  /** `null` si la salle n'est louée qu'à l'heure. */
  tarif_journee: string | null;
  equipements: string | null;
  /**
   * Calculée à la demande, **uniquement sur la fiche** (`GET /salles/{id}`) —
   * jamais sur la liste, non paginée (cf. `docs/roadmap.md`, 8.3). `null` tant
   * qu'aucun avis actif n'existe, jamais `0` : ce serait une moyenne valide.
   */
  note_moyenne: string | null;
  nombre_avis: number;
}
