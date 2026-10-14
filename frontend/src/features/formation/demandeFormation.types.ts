/**
 * Types de DEMANDE_FORMATION — formation sur commande (14 octobre 2026),
 * relevés des schemas de l'API.
 */

export type LieuFormation = 'Chez_delta' | 'En_entreprise' | 'Indifferent';

export type StatutDemandeFormation =
  'Nouvelle' | 'En_discussion' | 'Planifiee' | 'Refusee';

/** Ce que le visiteur envoie. Ni statut, ni note, ni client : le serveur. */
export interface DemandeFormationEnvoyee {
  sujet: string;
  nombre_participants: number;
  niveau?: string | null;
  periode_souhaitee?: string | null;
  lieu: LieuFormation;
  message?: string | null;
  nom_contact: string;
  contact: string;
}

/** Accusé rendu au demandeur. */
export interface AccuseDemandeFormation {
  id_demande: number;
  date_demande: string;
}

/** Demande lue par l'administration. */
export interface DemandeFormation {
  id_demande: number;
  sujet: string;
  nombre_participants: number;
  niveau: string | null;
  periode_souhaitee: string | null;
  lieu: LieuFormation;
  message: string | null;
  nom_contact: string;
  contact: string;
  statut: StatutDemandeFormation;
  note_interne: string | null;
  date_demande: string;
  id_client: number | null;
}
