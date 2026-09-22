/**
 * Types du module logement, relevés du schéma OpenAPI.
 *
 * `statut` décrit **l'état du bien**, jamais son occupation : il n'existe
 * aucune valeur « Occupé ». Savoir si une chambre est libre sur une période se
 * déduit des réservations (cf. `docs/mld.md`).
 */

export type StatutLogement = 'Disponible' | 'En_maintenance' | 'Hors_service';

export interface Logement {
  id_logement: number;
  type_chambre: string;
  capacite: number;
  tarif_nuitee: string;
  statut: StatutLogement;
  /**
   * Calculée à la demande, **uniquement sur la fiche** (`GET /logements/{id}`)
   * — jamais sur la liste, non paginée (cf. `docs/roadmap.md`, 8.3). `null`
   * tant qu'aucun avis actif n'existe, jamais `0` : ce serait une moyenne
   * valide.
   */
  note_moyenne: string | null;
  nombre_avis: number;
}

/**
 * Logement en sortie des listes d'**administration**, archives comprises.
 *
 * Type distinct de `Logement`, miroir des deux schemas de sortie du serveur :
 * `supprime_le` n'est exposé que sur la route protégée, et le déclarer sur le
 * type public inviterait à l'attendre là où il n'arrive jamais.
 */
export interface LogementAdministration extends Logement {
  /** `null` si actif, horodatage de l'archivage sinon. */
  supprime_le: string | null;
}

/**
 * Charge utile de création d'un logement.
 *
 * Ni `id_logement`, ni `supprime_le`, ni `statut` : le premier est attribué
 * par la base, le second est un cycle de vie que seuls l'archivage et la
 * restauration écrivent, le troisième naît toujours `Disponible` côté serveur
 * — passer un logement en maintenance est une décision explicite, prise
 * ensuite (cf. `LogementCreate`).
 */
export interface LogementEnvoye {
  type_chambre: string;
  capacite: number;
  tarif_nuitee: string;
}

/**
 * Charge utile de modification — **partielle**.
 *
 * `statut` y figure, contrairement à `LogementEnvoye` : changer l'état d'un
 * bien est précisément ce qu'un administrateur fait au fil du temps, ce que
 * la création ne permet pas.
 */
export type LogementModifie = Partial<LogementEnvoye> & { statut?: StatutLogement };
