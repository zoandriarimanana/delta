/**
 * Hooks et règles de l'administration des logements.
 *
 * Fichier distinct de `logement.hooks.ts`, qui sert le **catalogue public** :
 * les deux ne s'adressent ni aux mêmes routes, ni au même public. Les mêler
 * ferait importer des appels protégés dans les pages ouvertes à tous.
 *
 * **Aucun droit n'est vérifié ici.** `est_administrateur` n'est lisible nulle
 * part côté client : c'est le serveur qui refuse en 403, et l'écran se
 * contente de rendre ce refus lisible. Même patron que
 * `salle.administration.ts`.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  archiverLogement,
  recupererLogementsAdministration,
  restaurerLogement,
} from './logement.api';
import type { LogementAdministration } from './logement.types';

const MESSAGE_PAR_DEFAUT = 'L’opération a échoué. Réessayez dans un instant.';

/**
 * Extrait le message de refus de l'API, ou retombe sur un générique.
 *
 * Le **403** est le cas propre à ces écrans : un salarié sans droit voit
 * l'écran (l'authentification de personnel suffit à y accéder par le menu)
 * mais se voit refuser l'écriture. Le **409** dit qu'un logement porte encore
 * des réservations actives — repris tel quel, il dit exactement quoi corriger.
 */
export function messageDAdministration(erreur: unknown): string {
  const reponse = (
    erreur as { response?: { status?: number; data?: { detail?: unknown } } } | null
  )?.response;

  if (reponse?.status === 403) {
    return 'Cette action est réservée aux administrateurs.';
  }

  const detail = reponse?.data?.detail;
  return typeof detail === 'string' && detail.length > 0 ? detail : MESSAGE_PAR_DEFAUT;
}

/** Vrai si l'entité est archivée — `supprime_le` porte la date, ou `null`. */
export function estArchive(entite: { supprime_le: string | null }): boolean {
  return entite.supprime_le !== null;
}

export interface LogementsAdministration {
  logements: LogementAdministration[];
  chargement: boolean;
  erreur: string | null;
  /** Rejoue la lecture — après une écriture, la liste doit refléter la base. */
  recharger: () => void;
}

/** Charge le catalogue complet des logements, actifs **et** archivés. */
export function useLogementsAdministration(): LogementsAdministration {
  const [logements, setLogements] = useState<LogementAdministration[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    recupererLogementsAdministration()
      .then((donnees) => actif && setLogements(donnees))
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [jeton]);

  return { logements, chargement, erreur, recharger };
}

export interface ActionsLogements {
  archiverLeLogement: (idLogement: number) => Promise<boolean>;
  restaurerLeLogement: (idLogement: number) => Promise<boolean>;
  envoi: boolean;
  erreur: string | null;
}

/**
 * Archivage et restauration.
 *
 * **« Archiver » et non « supprimer »** : `DELETE` pose `supprime_le`, aucun
 * `DELETE` SQL n'est émis et `supprimer_definitivement` n'est exposé nulle
 * part. Nommer autrement promettrait un effacement qui n'a pas lieu.
 */
export function useActionsLogements(surSucces: () => void): ActionsLogements {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const executer = useCallback(
    async (appel: () => Promise<unknown>): Promise<boolean> => {
      setEnvoi(true);
      setErreur(null);
      try {
        await appel();
        surSucces();
        return true;
      } catch (erreurAppel) {
        setErreur(messageDAdministration(erreurAppel));
        return false;
      } finally {
        setEnvoi(false);
      }
    },
    [surSucces]
  );

  return {
    archiverLeLogement: (id) => executer(() => archiverLogement(id)),
    restaurerLeLogement: (id) => executer(() => restaurerLogement(id)),
    envoi,
    erreur,
  };
}
