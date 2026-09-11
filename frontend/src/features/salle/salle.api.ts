/**
 * Appels HTTP du module salle — et rien d'autre.
 *
 * Ces lectures sont **publiques** : un visiteur doit pouvoir consulter les
 * espaces sans compte.
 */

import { axiosClient } from '@/lib/axiosClient';

import type {
  Salle,
  SalleAdministration,
  SalleEnvoyee,
  SalleModifiee,
} from './salle.types';

const CHEMIN_SALLES = '/salles';

/** Catalogue des salles, filtrable par capacité minimale. */
export async function recupererSalles(capaciteMinimale?: number): Promise<Salle[]> {
  const reponse = await axiosClient.get<Salle[]>(CHEMIN_SALLES, {
    params:
      capaciteMinimale === undefined
        ? undefined
        : { capacite_minimale: capaciteMinimale },
  });
  return reponse.data;
}

export async function recupererSalle(idSalle: number): Promise<Salle> {
  const reponse = await axiosClient.get<Salle>(`${CHEMIN_SALLES}/${idSalle}`);
  return reponse.data;
}

// --- Administration -----------------------------------------------------------
//
// Ces appels visent des routes **protégées** par `get_current_personnel_administrateur`.
// Le frontend ne vérifie aucun droit : `est_administrateur` n'est lisible nulle
// part côté client, et c'est le serveur qui refuse en 403.

/**
 * Catalogue complet pour l'administration : salles **actives et archivées**.
 *
 * Route distincte de la liste publique, et non un paramètre : celle-ci est
 * ouverte à tous, et ne remonte jamais d'archive.
 */
export async function recupererSallesAdministration(): Promise<SalleAdministration[]> {
  const reponse = await axiosClient.get<SalleAdministration[]>(
    `${CHEMIN_SALLES}/administration`
  );
  return reponse.data;
}

export async function creerSalle(donnees: SalleEnvoyee): Promise<Salle> {
  const reponse = await axiosClient.post<Salle>(CHEMIN_SALLES, donnees);
  return reponse.data;
}

export async function modifierSalle(
  idSalle: number,
  donnees: SalleModifiee
): Promise<Salle> {
  const reponse = await axiosClient.put<Salle>(`${CHEMIN_SALLES}/${idSalle}`, donnees);
  return reponse.data;
}

/**
 * **Archive** une salle — aucun `DELETE` SQL n'est émis.
 *
 * Le nom de la fonction le dit, parce que l'écran doit le dire aussi :
 * `supprimer_definitivement` n'est exposé par aucun endpoint, et promettre un
 * effacement qui n'a pas lieu serait un mensonge d'interface.
 */
export async function archiverSalle(idSalle: number): Promise<void> {
  await axiosClient.delete(`${CHEMIN_SALLES}/${idSalle}`);
}

/**
 * Réactive une salle archivée. Ne peut pas échouer sur une collision :
 * `SALLE` ne porte aucune unicité, contrairement à `CATEGORIE_PRODUIT.libelle`.
 */
export async function restaurerSalle(idSalle: number): Promise<Salle> {
  const reponse = await axiosClient.post<Salle>(
    `${CHEMIN_SALLES}/${idSalle}/restauration`
  );
  return reponse.data;
}
