/**
 * Appels HTTP du module formation — et rien d'autre.
 *
 * Toutes ces lectures sont **publiques** : un visiteur doit pouvoir parcourir
 * l'offre sans compte. L'intercepteur ajoute le jeton s'il existe, mais aucun
 * de ces appels n'en dépend.
 */

import { axiosClient } from '@/lib/axiosClient';

import type {
  DomaineFormation,
  DomaineFormationAdministration,
  DomaineFormationEnvoye,
  Formation,
  FormationAdministration,
  FormationEnvoyee,
  FormationModifiee,
  SessionFormation,
} from './formation.types';

const CHEMIN_DOMAINES = '/domaines-formation';
const CHEMIN_FORMATIONS = '/formations';

export async function recupererDomaines(): Promise<DomaineFormation[]> {
  const reponse = await axiosClient.get<DomaineFormation[]>(CHEMIN_DOMAINES);
  return reponse.data;
}

/** Catalogue des formations, filtrable par domaine. */
export async function recupererFormations(idDomaine?: number): Promise<Formation[]> {
  const reponse = await axiosClient.get<Formation[]>(CHEMIN_FORMATIONS, {
    params: idDomaine === undefined ? undefined : { id_domaine: idDomaine },
  });
  return reponse.data;
}

export async function recupererFormation(idFormation: number): Promise<Formation> {
  const reponse = await axiosClient.get<Formation>(
    `${CHEMIN_FORMATIONS}/${idFormation}`
  );
  return reponse.data;
}

/** Sessions d'une formation, avec leur formateur quand il est affecté. */
export async function recupererSessions(
  idFormation: number
): Promise<SessionFormation[]> {
  const reponse = await axiosClient.get<SessionFormation[]>('/sessions-formation', {
    params: { id_formation: idFormation },
  });
  return reponse.data;
}

/**
 * Une session par son identifiant — porte `id_formation`, nécessaire pour
 * remonter à la formation depuis une réservation (qui ne porte que
 * `id_session`, cf. `reservation.service.ts::imageCible`).
 */
export async function recupererSession(idSession: number): Promise<SessionFormation> {
  const reponse = await axiosClient.get<SessionFormation>(
    `/sessions-formation/${idSession}`
  );
  return reponse.data;
}

// --- Administration -----------------------------------------------------------
//
// Ces appels visent des routes **protégées** par `get_current_personnel_administrateur`.
// Le frontend ne vérifie aucun droit : `est_administrateur` n'est lisible nulle
// part côté client, et c'est le serveur qui refuse en 403.

/**
 * Domaines complets pour l'administration : actifs **et** archivés.
 *
 * Route distincte de la liste publique, et non un paramètre : celle-ci est
 * ouverte à tous, et ne remonte jamais d'archive.
 */
export async function recupererDomainesAdministration(): Promise<
  DomaineFormationAdministration[]
> {
  const reponse = await axiosClient.get<DomaineFormationAdministration[]>(
    `${CHEMIN_DOMAINES}/administration`
  );
  return reponse.data;
}

export async function creerDomaine(
  donnees: DomaineFormationEnvoye
): Promise<DomaineFormation> {
  const reponse = await axiosClient.post<DomaineFormation>(CHEMIN_DOMAINES, donnees);
  return reponse.data;
}

export async function modifierDomaine(
  idDomaine: number,
  donnees: Partial<DomaineFormationEnvoye>
): Promise<DomaineFormation> {
  const reponse = await axiosClient.put<DomaineFormation>(
    `${CHEMIN_DOMAINES}/${idDomaine}`,
    donnees
  );
  return reponse.data;
}

/**
 * **Archive** un domaine — aucun `DELETE` SQL n'est émis.
 *
 * Le nom de la fonction le dit, parce que l'écran doit le dire aussi :
 * `supprimer_definitivement` n'est exposé par aucun endpoint, et promettre un
 * effacement qui n'a pas lieu serait un mensonge d'interface. 409 si le
 * domaine porte encore des formations actives.
 */
export async function archiverDomaine(idDomaine: number): Promise<void> {
  await axiosClient.delete(`${CHEMIN_DOMAINES}/${idDomaine}`);
}

/**
 * Réactive un domaine archivé.
 *
 * **Peut échouer en 409** : le libellé a pu être repris pendant l'archivage,
 * l'index unique étant partiel — même situation que `restaurerCategorie`.
 */
export async function restaurerDomaine(idDomaine: number): Promise<DomaineFormation> {
  const reponse = await axiosClient.post<DomaineFormation>(
    `${CHEMIN_DOMAINES}/${idDomaine}/restauration`
  );
  return reponse.data;
}

/**
 * Formations complètes pour l'administration : actives **et** archivées.
 *
 * Route distincte de la liste publique, et non un paramètre : celle-ci est
 * ouverte à tous, et ne remonte jamais d'archive. Sert aussi à alimenter la
 * fiche (`FormationDetailAdministrationPage`) : aucune route
 * `/administration/{id}` n'existe pour cette entité, contrairement à
 * `ABONNEMENT` — la fiche retrouve sa formation dans cette liste plutôt que
 * d'appeler `GET /formations/{id}`, qui exclurait une formation archivée.
 */
export async function recupererFormationsAdministration(): Promise<
  FormationAdministration[]
> {
  const reponse = await axiosClient.get<FormationAdministration[]>(
    `${CHEMIN_FORMATIONS}/administration`
  );
  return reponse.data;
}

export async function creerFormation(donnees: FormationEnvoyee): Promise<Formation> {
  const reponse = await axiosClient.post<Formation>(CHEMIN_FORMATIONS, donnees);
  return reponse.data;
}

export async function modifierFormation(
  idFormation: number,
  donnees: FormationModifiee
): Promise<Formation> {
  const reponse = await axiosClient.put<Formation>(
    `${CHEMIN_FORMATIONS}/${idFormation}`,
    donnees
  );
  return reponse.data;
}

/**
 * **Archive** une formation — aucun `DELETE` SQL n'est émis. 409 si elle
 * porte encore des sessions actives.
 */
export async function archiverFormation(idFormation: number): Promise<void> {
  await axiosClient.delete(`${CHEMIN_FORMATIONS}/${idFormation}`);
}

/**
 * Réactive une formation archivée. Ne peut pas échouer sur une collision :
 * `FORMATION` ne porte aucune unicité, deux formations pouvant légitimement
 * partager le même titre.
 */
export async function restaurerFormation(idFormation: number): Promise<Formation> {
  const reponse = await axiosClient.post<Formation>(
    `${CHEMIN_FORMATIONS}/${idFormation}/restauration`
  );
  return reponse.data;
}
