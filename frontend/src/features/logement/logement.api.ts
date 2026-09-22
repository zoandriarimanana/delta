/** Appels HTTP du module logement — et rien d'autre. Lectures publiques. */

import { axiosClient } from '@/lib/axiosClient';

import type {
  Logement,
  LogementAdministration,
  LogementEnvoye,
  LogementModifie,
  StatutLogement,
} from './logement.types';

const CHEMIN_LOGEMENTS = '/logements';

/**
 * Catalogue des logements, filtrable par état et par capacité.
 *
 * Le filtre par statut ne dit **rien** de la disponibilité à une date donnée :
 * il retient les logements dont l'état le permet.
 */
export async function recupererLogements(
  statut?: StatutLogement,
  capaciteMinimale?: number
): Promise<Logement[]> {
  const params: Record<string, string | number> = {};
  if (statut !== undefined) {
    params.statut = statut;
  }
  if (capaciteMinimale !== undefined) {
    params.capacite_minimale = capaciteMinimale;
  }
  const reponse = await axiosClient.get<Logement[]>(CHEMIN_LOGEMENTS, {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return reponse.data;
}

export async function recupererLogement(idLogement: number): Promise<Logement> {
  const reponse = await axiosClient.get<Logement>(`${CHEMIN_LOGEMENTS}/${idLogement}`);
  return reponse.data;
}

// --- Administration -----------------------------------------------------------
//
// Ces appels visent des routes **protégées** par `get_current_personnel_administrateur`.
// Le frontend ne vérifie aucun droit : `est_administrateur` n'est lisible nulle
// part côté client, et c'est le serveur qui refuse en 403.

/**
 * Catalogue complet pour l'administration : logements **actifs et archivés**.
 *
 * Route distincte de la liste publique, et non un paramètre : celle-ci est
 * ouverte à tous, et ne remonte jamais d'archive.
 */
export async function recupererLogementsAdministration(): Promise<
  LogementAdministration[]
> {
  const reponse = await axiosClient.get<LogementAdministration[]>(
    `${CHEMIN_LOGEMENTS}/administration`
  );
  return reponse.data;
}

export async function creerLogement(donnees: LogementEnvoye): Promise<Logement> {
  const reponse = await axiosClient.post<Logement>(CHEMIN_LOGEMENTS, donnees);
  return reponse.data;
}

export async function modifierLogement(
  idLogement: number,
  donnees: LogementModifie
): Promise<Logement> {
  const reponse = await axiosClient.put<Logement>(
    `${CHEMIN_LOGEMENTS}/${idLogement}`,
    donnees
  );
  return reponse.data;
}

/**
 * **Archive** un logement — aucun `DELETE` SQL n'est émis.
 *
 * Le nom de la fonction le dit, parce que l'écran doit le dire aussi :
 * `supprimer_definitivement` n'est exposé par aucun endpoint, et promettre un
 * effacement qui n'a pas lieu serait un mensonge d'interface.
 */
export async function archiverLogement(idLogement: number): Promise<void> {
  await axiosClient.delete(`${CHEMIN_LOGEMENTS}/${idLogement}`);
}

/**
 * Réactive un logement archivé. Ne peut pas échouer sur une collision :
 * `LOGEMENT` ne porte aucune unicité, deux chambres pouvant légitimement
 * partager le même `type_chambre`.
 */
export async function restaurerLogement(idLogement: number): Promise<Logement> {
  const reponse = await axiosClient.post<Logement>(
    `${CHEMIN_LOGEMENTS}/${idLogement}/restauration`
  );
  return reponse.data;
}
