/**
 * Hooks du module paiement : état, effets, et rien de visuel.
 *
 * Le paiement mobile money se fait **en deux temps** : la plateforme envoie la
 * demande à l'opérateur, puis le client la **valide sur son téléphone** (code
 * secret). La confirmation arrive au serveur par webhook ; l'écran ne la voit
 * pas directement — il **relit le statut de la commande** à intervalle
 * régulier, par une fonction fournie par l'appelant (le module paiement ne
 * connaît pas l'API des commandes).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { textesCourants } from '@/lib/langue';

import { initierPaiement, simulerConfirmation } from './paiement.api';
import { TEXTES_PAIEMENT } from './paiement.textes';
import type { CiblePaiement, Paiement, PaiementEnvoye } from './paiement.types';

/** Intervalle de relecture, et durée au-delà de laquelle on cesse d'attendre. */
export const INTERVALLE_RELECTURE_MS = 4000;
export const ATTENTE_MAX_MS = 3 * 60 * 1000;

function messageDePaiement(erreur: unknown): string {
  const detail = (erreur as { response?: { data?: { detail?: unknown } } } | null)
    ?.response?.data?.detail;
  if (typeof detail === 'string' && detail.length > 0) return detail;
  // 422 de validation : une liste d'objets — on en reprend le premier message
  // lisible (« Ce numéro n'est pas un numéro MVola… ») plutôt que du JSON.
  if (Array.isArray(detail)) {
    const premier = detail.find(
      (e): e is { msg: string } => typeof (e as { msg?: unknown })?.msg === 'string'
    );
    if (premier) return premier.msg.replace(/^Value error, /, '');
  }
  return textesCourants(TEXTES_PAIEMENT).erreur;
}

export interface EtatPaiement {
  paiement: Paiement | null;
  envoi: boolean;
  erreur: string | null;
  /** Initie le paiement. `paiement` porte ensuite son statut (`En_attente`). */
  initier: (donnees: PaiementEnvoye) => Promise<void>;
  /** Simule la confirmation de l'opérateur — développement seulement. */
  simuler: () => Promise<void>;
  /** Revient au choix du moyen de paiement (nouvelle tentative). */
  recommencer: () => void;
}

export function usePaiement(cible: CiblePaiement): EtatPaiement {
  const [paiement, setPaiement] = useState<Paiement | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const initier = useCallback(
    async (donnees: PaiementEnvoye): Promise<void> => {
      setEnvoi(true);
      setErreur(null);
      try {
        setPaiement(await initierPaiement(cible, donnees));
      } catch (erreurAppel) {
        setErreur(messageDePaiement(erreurAppel));
      } finally {
        setEnvoi(false);
      }
    },
    // `cible` est un objet recréé à chaque rendu par l'appelant : on dépend de
    // ce qui l'identifie, pas de son identité.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cible.type, cible.type === 'client' ? cible.idCommande : cible.reference]
  );

  const simuler = useCallback(async (): Promise<void> => {
    if (paiement === null) return;
    setEnvoi(true);
    setErreur(null);
    try {
      setPaiement(await simulerConfirmation(cible, paiement.id_paiement));
    } catch (erreurAppel) {
      setErreur(messageDePaiement(erreurAppel));
    } finally {
      setEnvoi(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paiement, cible.type]);

  const recommencer = useCallback(() => {
    setPaiement(null);
    setErreur(null);
  }, []);

  return { paiement, envoi, erreur, initier, simuler, recommencer };
}

/**
 * Relit le statut de la commande tant qu'un paiement attend sa validation.
 *
 * Rend `true` dès que la commande n'est plus `En_attente` (paiement reçu), et
 * `expire` passé `ATTENTE_MAX_MS` — l'écran propose alors de réessayer, sans
 * prétendre que le paiement a échoué : la validation peut encore arriver.
 */
export function useAttenteConfirmation(
  actif: boolean,
  lireStatutCommande: (() => Promise<string>) | undefined
): { confirmee: boolean; expire: boolean } {
  const [confirmee, setConfirmee] = useState(false);
  const [expire, setExpire] = useState(false);
  const lecture = useRef(lireStatutCommande);
  lecture.current = lireStatutCommande;

  useEffect(() => {
    if (!actif || lecture.current === undefined) return undefined;
    setExpire(false);
    const debut = Date.now();
    let annule = false;
    const minuterie = window.setInterval(() => {
      if (Date.now() - debut > ATTENTE_MAX_MS) {
        setExpire(true);
        window.clearInterval(minuterie);
        return;
      }
      void lecture
        .current?.()
        .then((statut) => {
          if (!annule && statut !== 'En_attente') {
            setConfirmee(true);
            window.clearInterval(minuterie);
          }
        })
        .catch(() => {
          // Réseau : on réessaiera au prochain tour.
        });
    }, INTERVALLE_RELECTURE_MS);
    return () => {
      annule = true;
      window.clearInterval(minuterie);
    };
  }, [actif]);

  return { confirmee, expire };
}
