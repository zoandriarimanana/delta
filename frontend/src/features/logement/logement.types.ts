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
}
