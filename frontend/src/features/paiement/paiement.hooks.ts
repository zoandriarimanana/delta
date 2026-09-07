/**
 * Hooks du module paiement.
 *
 * L'API renvoie des erreurs **métier** que le client peut utiliser — « cette
 * commande est annulée », « cette commande a déjà été payée » (409). Les
 * remplacer par un message générique ferait perdre exactement ce qui permet
 * de comprendre le refus — même traitement que `avis.hooks.ts`.
 */

import { useCallback, useState } from 'react';

import { initierPaiement, simulerConfirmation } from './paiement.api';
import type { Paiement, PaiementEnvoye } from './paiement.types';

const MESSAGE_ERREUR_PAR_DEFAUT =
  'Le paiement n’a pas pu être traité. Réessayez dans un instant.';

/** Extrait le message métier de l'API, ou retombe sur un message générique. */
function messageDePaiement(erreur: unknown): string {
  const detail = (erreur as { response?: { data?: { detail?: unknown } } } | null)
    ?.response?.data?.detail;
  return typeof detail === 'string' && detail.length > 0
    ? detail
    : MESSAGE_ERREUR_PAR_DEFAUT;
}

export interface EtatPaiement {
  paiement: Paiement | null;
  envoi: boolean;
  erreur: string | null;
  /** Initie le paiement. `paiement` porte ensuite son statut (`En_attente`). */
  initier: (idCommande: number, donnees: PaiementEnvoye) => Promise<void>;
  /**
   * Simule la confirmation d'un paiement déjà initié — dev uniquement (cf.
   * `paiement.api.ts`). Sans effet si aucun paiement n'a encore été initié.
   */
  simuler: () => Promise<void>;
}

/**
 * Suit le cycle de vie d'un paiement, de l'initiation à la confirmation
 * simulée : `paiement.statut` passe de `En_attente` à `Reussi` (ou `Echoue`)
 * une fois `simuler()` appelé — le même chemin qu'un vrai webhook, rejoué
 * manuellement le temps de la simulation.
 */
export function usePaiement(): EtatPaiement {
  const [paiement, setPaiement] = useState<Paiement | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const initier = useCallback(
    async (idCommande: number, donnees: PaiementEnvoye): Promise<void> => {
      setEnvoi(true);
      setErreur(null);
      try {
        setPaiement(await initierPaiement(idCommande, donnees));
      } catch (erreurAppel) {
        setErreur(messageDePaiement(erreurAppel));
      } finally {
        setEnvoi(false);
      }
    },
    []
  );

  const simuler = useCallback(async (): Promise<void> => {
    if (paiement === null) {
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      setPaiement(await simulerConfirmation(paiement.id_paiement));
    } catch (erreurAppel) {
      setErreur(messageDePaiement(erreurAppel));
    } finally {
      setEnvoi(false);
    }
  }, [paiement]);

  return { paiement, envoi, erreur, initier, simuler };
}
