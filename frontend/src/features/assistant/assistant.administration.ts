/**
 * Hooks de l'administration de l'assistant IA.
 *
 * **Aucun droit n'est vérifié ici.** `est_administrateur` n'est lisible nulle
 * part côté client : c'est le serveur qui refuse en 403, et l'écran rend ce
 * refus lisible. Même patron que `logement.administration.ts`.
 */

import { useCallback, useEffect, useState } from 'react';

import { lancerReindexation, recupererEtat } from './assistant.api';
import { messageDAdministration } from './assistant.service';
import type { EtatAssistant, ReindexationAssistant } from './assistant.types';

export interface EtatAdministration {
  etat: EtatAssistant | null;
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

export function useEtatAssistant(): EtatAdministration {
  const [etat, setEtat] = useState<EtatAssistant | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    recupererEtat()
      .then((donnees) => {
        if (annule) return;
        setEtat(donnees);
        setErreur(null);
      })
      .catch((cause: unknown) => {
        if (!annule) setErreur(messageDAdministration(cause));
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return { etat, chargement, erreur, recharger };
}

export interface Reindexation {
  resultat: ReindexationAssistant | null;
  enCours: boolean;
  erreur: string | null;
  lancer: () => Promise<void>;
}

/** Réindexation complète, puis `surFin` — pour rafraîchir l'état affiché. */
export function useReindexation(surFin: () => void): Reindexation {
  const [resultat, setResultat] = useState<ReindexationAssistant | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const lancer = useCallback(async () => {
    setEnCours(true);
    setErreur(null);
    setResultat(null);
    try {
      setResultat(await lancerReindexation());
    } catch (cause) {
      setErreur(messageDAdministration(cause));
    } finally {
      setEnCours(false);
      surFin();
    }
  }, [surFin]);

  return { resultat, enCours, erreur, lancer };
}
