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

/**
 * Salle en sortie des listes d'**administration**, archives comprises.
 *
 * Type distinct de `Salle`, miroir des deux schemas de sortie du serveur :
 * `supprime_le` n'est exposé que sur la route protégée, et le déclarer sur le
 * type public inviterait à l'attendre là où il n'arrive jamais.
 */
export interface SalleAdministration extends Salle {
  /** `null` si active, horodatage de l'archivage sinon. */
  supprime_le: string | null;
}

/**
 * Charge utile de création d'une salle.
 *
 * Ni `id_salle` ni `supprime_le` : le premier est attribué par la base, le
 * second est un cycle de vie que seuls l'archivage et la restauration écrivent.
 */
export interface SalleEnvoyee {
  nom: string;
  capacite: number;
  tarif_horaire?: string | null;
  tarif_journee?: string | null;
  equipements?: string | null;
}

/**
 * Charge utile de modification — **partielle**.
 *
 * Le serveur n'écrit que les clés présentes : envoyer un objet complet
 * écraserait des colonnes que l'utilisateur n'a pas touchées.
 */
export type SalleModifiee = Partial<SalleEnvoyee>;
