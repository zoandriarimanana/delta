/** Appels de l'API des demandes de formation — rien d'autre. */

import { axiosClient } from '@/lib/axiosClient';

import type {
  AccuseDemandeFormation,
  DemandeFormation,
  DemandeFormationEnvoyee,
  StatutDemandeFormation,
} from './demandeFormation.types';

const CHEMIN = '/demandes-formation';

export async function envoyerDemandeFormation(
  donnees: DemandeFormationEnvoyee
): Promise<AccuseDemandeFormation> {
  const reponse = await axiosClient.post<AccuseDemandeFormation>(CHEMIN, donnees);
  return reponse.data;
}

export async function recupererDemandesFormation(): Promise<DemandeFormation[]> {
  const reponse = await axiosClient.get<DemandeFormation[]>(`${CHEMIN}/administration`);
  return reponse.data;
}

export async function suivreDemandeFormation(
  idDemande: number,
  suivi: { statut: StatutDemandeFormation; note_interne: string | null }
): Promise<DemandeFormation> {
  const reponse = await axiosClient.put<DemandeFormation>(
    `${CHEMIN}/administration/${idDemande}`,
    suivi
  );
  return reponse.data;
}

export async function archiverDemandeFormation(idDemande: number): Promise<void> {
  await axiosClient.delete(`${CHEMIN}/administration/${idDemande}`);
}
