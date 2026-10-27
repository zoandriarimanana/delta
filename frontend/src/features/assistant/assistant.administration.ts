/**
 * Hooks de l'administration de l'assistant IA.
 *
 * **Aucun droit n'est vérifié ici.** `est_administrateur` n'est lisible nulle
 * part côté client : c'est le serveur qui refuse en 403, et l'écran rend ce
 * refus lisible. Même patron que `logement.administration.ts`.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  archiverDocument,
  lancerReindexation,
  recupererDocuments,
  recupererEtat,
  restaurerDocument,
  televerserDocument,
} from './assistant.api';
import { messageDAdministration } from './assistant.service';
import type {
  DocumentConnaissance,
  EtatAssistant,
  PublicCible,
  ReindexationAssistant,
} from './assistant.types';

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

export interface BaseDeConnaissances {
  documents: DocumentConnaissance[];
  chargement: boolean;
  erreur: string | null;
  envoi: boolean;
  /** Message de l'action en cours : refus de format, 403, etc. */
  erreurAction: string | null;
  recharger: () => void;
  televerser: (
    titre: string,
    publicCible: PublicCible,
    fichier: File
  ) => Promise<boolean>;
  archiver: (idDocument: number) => Promise<void>;
  restaurer: (idDocument: number) => Promise<void>;
}

/**
 * Documents de la base de connaissances, archives comprises : l'écran filtre
 * lui-même, comme l'administration des logements.
 *
 * Les refus du serveur sont repris **tels quels** : « Format non pris en
 * charge », « PDF scanné », « dépasse 5 Mio » disent exactement quoi corriger.
 */
export function useBaseDeConnaissances(): BaseDeConnaissances {
  const [documents, setDocuments] = useState<DocumentConnaissance[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    recupererDocuments(true)
      .then((donnees) => {
        if (annule) return;
        setDocuments(donnees);
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

  const executer = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setEnvoi(true);
      setErreurAction(null);
      try {
        await action();
        recharger();
        return true;
      } catch (cause) {
        setErreurAction(messageDAdministration(cause));
        return false;
      } finally {
        setEnvoi(false);
      }
    },
    [recharger]
  );

  return {
    documents,
    chargement,
    erreur,
    envoi,
    erreurAction,
    recharger,
    televerser: (titre, publicCible, fichier) =>
      executer(() => televerserDocument(titre, publicCible, fichier)),
    archiver: async (idDocument) => {
      await executer(() => archiverDocument(idDocument));
    },
    restaurer: async (idDocument) => {
      await executer(() => restaurerDocument(idDocument));
    },
  };
}
