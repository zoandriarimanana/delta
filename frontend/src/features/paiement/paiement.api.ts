/**
 * Appels HTTP du module paiement — et rien d'autre.
 *
 * Deux portes pour la même action : un client connecté paie **sa** commande
 * (identifiant + cookie de session), un invité paie la sienne par sa
 * **référence publique** — la même clé qui lui permet de la consulter.
 */

import { axiosClient } from '@/lib/axiosClient';

import type { CiblePaiement, Paiement, PaiementEnvoye } from './paiement.types';

function cheminInitiation(cible: CiblePaiement): string {
  switch (cible.type) {
    case 'client':
      return `/commandes/${cible.idCommande}/paiements`;
    case 'invite':
      return `/commandes/invite/${cible.reference}/paiements`;
    case 'reservation':
      return `/reservations/${cible.idReservation}/paiements`;
  }
}

export async function initierPaiement(
  cible: CiblePaiement,
  donnees: PaiementEnvoye
): Promise<Paiement> {
  const reponse = await axiosClient.post<Paiement>(cheminInitiation(cible), donnees);
  return reponse.data;
}

/**
 * Simule la confirmation que l'opérateur enverrait de lui-même — en
 * développement seulement (404 sinon, cf. `docs/mld.md`).
 */
export async function simulerConfirmation(
  cible: CiblePaiement,
  idPaiement: number
): Promise<Paiement> {
  // Un client connecté — commande ou acompte — passe par la même route ; un
  // invité, sans jeton, par celle qui vérifie sa référence publique.
  const chemin =
    cible.type === 'invite'
      ? `/paiements/invite/${cible.reference}/${idPaiement}/simuler-confirmation`
      : `/paiements/${idPaiement}/simuler-confirmation`;
  const reponse = await axiosClient.post<Paiement>(chemin);
  return reponse.data;
}
