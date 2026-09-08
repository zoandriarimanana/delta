/**
 * Appels HTTP du module abonnement — et rien d'autre.
 *
 * Aucune mise en forme, aucune règle métier : ce fichier traduit une intention
 * en requête et rend la réponse telle quelle. L'instance axios est celle de
 * `lib/axiosClient`, jamais une nouvelle (cf. `docs/architecture.md`).
 *
 * Tous ces appels visent des routes **protégées** par
 * `get_current_personnel_administrateur`. Le frontend ne vérifie aucun droit :
 * `est_administrateur` n'est lisible nulle part côté client, et c'est le
 * serveur qui refuse en 403.
 */

import { axiosClient } from '@/lib/axiosClient';

import type {
  Abonnement,
  AbonnementEnvoye,
  AbonnementModifie,
  Beneficiaire,
  BeneficiaireEnvoye,
  ClientEntrepriseAdministration,
  ConsommationRepas,
  SoldeAbonnement,
} from './abonnement.types';

const CHEMIN_ABONNEMENTS = '/abonnements';
const CHEMIN_BENEFICIAIRES = '/beneficiaires';
const CHEMIN_CONSOMMATIONS = '/consommations';
const CHEMIN_CLIENTS_ENTREPRISE = '/clients-entreprise';

export async function recupererAbonnementsAdministration(): Promise<Abonnement[]> {
  const reponse = await axiosClient.get<Abonnement[]>(
    `${CHEMIN_ABONNEMENTS}/administration`
  );
  return reponse.data;
}

export async function recupererAbonnementAdministration(
  idAbonnement: number
): Promise<Abonnement> {
  const reponse = await axiosClient.get<Abonnement>(
    `${CHEMIN_ABONNEMENTS}/administration/${idAbonnement}`
  );
  return reponse.data;
}

export async function creerAbonnement(donnees: AbonnementEnvoye): Promise<Abonnement> {
  const reponse = await axiosClient.post<Abonnement>(
    `${CHEMIN_ABONNEMENTS}/administration`,
    donnees
  );
  return reponse.data;
}

export async function modifierAbonnement(
  idAbonnement: number,
  donnees: AbonnementModifie
): Promise<Abonnement> {
  const reponse = await axiosClient.put<Abonnement>(
    `${CHEMIN_ABONNEMENTS}/administration/${idAbonnement}`,
    donnees
  );
  return reponse.data;
}

/** **Archive** un abonnement — aucun `DELETE` SQL n'est émis. **409** s'il
 * couvre encore un bénéficiaire actif. */
export async function archiverAbonnement(idAbonnement: number): Promise<void> {
  await axiosClient.delete(`${CHEMIN_ABONNEMENTS}/administration/${idAbonnement}`);
}

/** Solde calculé à la demande, jamais stocké côté serveur. */
export async function recupererSoldeAdministration(
  idAbonnement: number
): Promise<SoldeAbonnement> {
  const reponse = await axiosClient.get<SoldeAbonnement>(
    `${CHEMIN_CONSOMMATIONS}/administration/solde/${idAbonnement}`
  );
  return reponse.data;
}

/** Consommations d'un abonnement donné — `id_abonnement` filtre côté serveur,
 * pas de téléchargement de l'historique complet de toutes les entreprises. */
export async function recupererConsommationsAdministration(
  idAbonnement: number
): Promise<ConsommationRepas[]> {
  const reponse = await axiosClient.get<ConsommationRepas[]>(
    `${CHEMIN_CONSOMMATIONS}/administration`,
    { params: { id_abonnement: idAbonnement } }
  );
  return reponse.data;
}

/** Bénéficiaires d'un abonnement donné — même filtrage côté serveur que les
 * consommations. N'est utile qu'en `mode_suivi = Individuel`. */
export async function recupererBeneficiairesAdministration(
  idAbonnement: number
): Promise<Beneficiaire[]> {
  const reponse = await axiosClient.get<Beneficiaire[]>(
    `${CHEMIN_BENEFICIAIRES}/administration`,
    { params: { id_abonnement: idAbonnement } }
  );
  return reponse.data;
}

export async function creerBeneficiaireAdministration(
  donnees: BeneficiaireEnvoye
): Promise<Beneficiaire> {
  const reponse = await axiosClient.post<Beneficiaire>(
    `${CHEMIN_BENEFICIAIRES}/administration`,
    donnees
  );
  return reponse.data;
}

/** Entreprises actives, pour peupler le sélecteur de création. Ni recherche
 * ni pagination — voir la docstring du service côté serveur. */
export async function recupererClientsEntrepriseAdministration(): Promise<
  ClientEntrepriseAdministration[]
> {
  const reponse = await axiosClient.get<ClientEntrepriseAdministration[]>(
    `${CHEMIN_CLIENTS_ENTREPRISE}/administration`
  );
  return reponse.data;
}
