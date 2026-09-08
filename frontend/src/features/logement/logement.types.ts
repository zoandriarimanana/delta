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
