/**
 * Appels HTTP du module personnel — et rien d'autre.
 *
 * L'instance axios est celle de `lib/axiosClient`, jamais une nouvelle.
 *
 * Toutes les écritures visent des routes protégées par
 * `get_current_personnel_administrateur` ; la lecture (`lister`, `obtenir`)
 * n'exige qu'un salarié authentifié. Le frontend ne vérifie aucun droit :
 * `est_administrateur` n'est lisible nulle part côté client, et c'est le
 * serveur qui refuse en 403.
 */

import { axiosClient } from '@/lib/axiosClient';

import type {
  FonctionPersonnel,
  Personnel,
  PersonnelEnvoye,
  PersonnelModifie,
} from './personnel.types';

const CHEMIN = '/personnel';

/**
 * Personnel actif, filtrable par fonction.
 *
 * **N'inclut jamais les lignes archivées** : `GET /personnel` ne porte pas
 * de paramètre `inclure_supprimes`, contrairement à `GET
 * /produits/administration`. Un membre archivé redevient donc introuvable
 * dès qu'on quitte l'écran qui vient de l'archiver — voir
 * `personnel.administration.ts`, qui compense par une restauration en
 * « annulation immédiate » plutôt qu'une liste d'archives.
 */
export async function listerPersonnel(
  fonction?: FonctionPersonnel
): Promise<Personnel[]> {
  const reponse = await axiosClient.get<Personnel[]>(CHEMIN, {
    params: fonction === undefined ? undefined : { fonction },
  });
  return reponse.data;
}

export async function obtenirPersonnel(idPersonnel: number): Promise<Personnel> {
  const reponse = await axiosClient.get<Personnel>(`${CHEMIN}/${idPersonnel}`);
  return reponse.data;
}

export async function creerPersonnel(donnees: PersonnelEnvoye): Promise<Personnel> {
  const reponse = await axiosClient.post<Personnel>(CHEMIN, donnees);
  return reponse.data;
}

export async function modifierPersonnel(
  idPersonnel: number,
  donnees: PersonnelModifie
): Promise<Personnel> {
  const reponse = await axiosClient.put<Personnel>(`${CHEMIN}/${idPersonnel}`, donnees);
  return reponse.data;
}

/** **Archive** un membre du personnel — aucun `DELETE` SQL n'est émis. */
export async function archiverPersonnel(idPersonnel: number): Promise<void> {
  await axiosClient.delete(`${CHEMIN}/${idPersonnel}`);
}

/** Réactive une ligne archivée. **409** si l'adresse professionnelle a été
 * reprise entre-temps par une ligne active (index unique partiel). */
export async function restaurerPersonnel(idPersonnel: number): Promise<Personnel> {
  const reponse = await axiosClient.post<Personnel>(
    `${CHEMIN}/${idPersonnel}/restauration`
  );
  return reponse.data;
}

/** Efface les données personnelles — seul chemin de conformité (droit à
 * l'effacement). Archive la ligne au passage. Idempotent. */
export async function anonymiserPersonnel(idPersonnel: number): Promise<Personnel> {
  const reponse = await axiosClient.post<Personnel>(
    `${CHEMIN}/${idPersonnel}/anonymisation`
  );
  return reponse.data;
}
