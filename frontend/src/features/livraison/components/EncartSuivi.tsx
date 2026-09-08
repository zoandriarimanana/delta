/**
 * Encart de suivi autonome : charge lui-même, puis délègue l'affichage.
 *
 * Les deux pages qui l'utilisent — historique connecté et page invitée — n'ont
 * ainsi rien à savoir du chargement. C'est ce qui évite de dupliquer la gestion
 * du 404 « pas de livraison », qui est le cas courant et non une erreur.
 */

import { useSuiviLivraison, useSuiviLivraisonInvitee } from '../livraison.hooks';
import type { EtatSuivi } from '../livraison.hooks';
import SuiviLivraison from './SuiviLivraison';

function Rendu({ etat }: { etat: EtatSuivi }) {
  // Une commande à retirer n'a pas de livraison : on n'affiche rien plutôt
  // qu'un bloc vide, qui se lirait comme une anomalie.
  if (etat.sansLivraison || (etat.suivi === null && !etat.erreur)) {
    return null;
  }

  if (etat.erreur !== null) {
    return (
      <p role="alert" className="mt-4 text-sm text-red-800">
        {etat.erreur}
      </p>
    );
  }

  return etat.suivi === null ? null : <SuiviLivraison suivi={etat.suivi} />;
}

/** Suivi d'une commande du client connecté. */
export function EncartSuiviCommande({ idCommande }: { idCommande: number }) {
  return <Rendu etat={useSuiviLivraison(idCommande)} />;
}

/** Suivi d'une commande invitée, par sa référence publique. */
export function EncartSuiviInvite({ reference }: { reference: string }) {
  return <Rendu etat={useSuiviLivraisonInvitee(reference)} />;
}
