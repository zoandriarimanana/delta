/**
 * Types du module avis, relevés du schéma OpenAPI.
 *
 * Pas de `AvisModifie` : un avis ne se corrige pas, il se remplace — la
 * modération l'archive et un nouveau peut être déposé (cf. `docs/mld.md`).
 * Le frontend ne propose donc jamais d'édition.
 */

export type TypeAvis = 'Produit' | 'Service';

export interface Avis {
  id_avis: number;
  type_avis: TypeAvis;
  note: number;
  commentaire: string | null;
  date_avis: string;
  id_client: number;
  id_ligne: number | null;
  id_reservation: number | null;
}

/**
 * Charge utile de création.
 *
 * **Union discriminée par `type_avis`**, comme `ReservationEnvoyee` : le
 * compilateur refuse `type_avis: 'Produit'` avec un `id_reservation`, sans
 * attendre le 422 du serveur.
 */
export interface AvisProduitEnvoye {
  type_avis: 'Produit';
  note: number;
  commentaire?: string | null;
  id_ligne: number;
}

export interface AvisServiceEnvoye {
  type_avis: 'Service';
  note: number;
  commentaire?: string | null;
  id_reservation: number;
}

export type AvisEnvoye = AvisProduitEnvoye | AvisServiceEnvoye;
