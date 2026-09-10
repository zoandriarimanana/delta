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

/**
 * URL de la photo de profil — jamais un chemin de fichier local, une route
 * authentifiée (`GET /personnel/{id}/photo`, cf. `docs/architecture.md`).
 *
 * Une balise `<img>` qui pointe ici envoie le cookie de session comme toute
 * requête `GET` same-site ; aucun code d'authentification à écrire ici.
 * Répond 404 si le membre n'a pas de photo — `components/ui/Avatar`
 * traduit ce cas en icône générique, jamais en image cassée.
 */
export function urlPhotoPersonnel(idPersonnel: number): string {
  return `${axiosClient.defaults.baseURL}${CHEMIN}/${idPersonnel}/photo`;
}

/**
 * Téléverse ou remplace la photo de profil. Un seul endpoint pour les deux
 * cas — voir `docs/architecture.md`, section « Photo de profil ».
 */
export async function televerserPhotoPersonnel(
  idPersonnel: number,
  fichier: File
): Promise<void> {
  const corps = new FormData();
  corps.append('fichier', fichier);
  // `Content-Type` explicitement retiré : `axiosClient` le fixe par défaut à
  // `application/json` pour toute requête, ce qui écraserait sinon la
  // frontière (`boundary`) que le navigateur doit générer lui-même pour un
  // `FormData` — sans elle, le serveur ne peut pas découper les parties du
  // corps multipart.
  await axiosClient.post(`${CHEMIN}/${idPersonnel}/photo`, corps, {
    headers: { 'Content-Type': undefined },
  });
}

/** Retire la photo de profil, sans rien archiver. Idempotent. */
export async function supprimerPhotoPersonnel(idPersonnel: number): Promise<void> {
  await axiosClient.delete(`${CHEMIN}/${idPersonnel}/photo`);
}

/**
 * Télécharge le badge (PNG) — photo ou avatar générique, identité, fonction,
 * QR code. Généré à la demande côté serveur, jamais stocké : cet appel
 * déclenche donc une vraie composition d'image à chaque clic, pas une
 * lecture de cache.
 *
 * `responseType: 'blob'` : la réponse est une image binaire, pas du JSON —
 * axios ne doit pas tenter de la parser comme tel.
 */
export async function obtenirBadgePersonnel(idPersonnel: number): Promise<Blob> {
  const reponse = await axiosClient.get<Blob>(`${CHEMIN}/${idPersonnel}/badge`, {
    responseType: 'blob',
  });
  return reponse.data;
}
