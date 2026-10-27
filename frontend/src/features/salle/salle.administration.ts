/**
 * Hooks et règles de l'administration des salles.
 *
 * Fichier distinct de `salle.hooks.ts`, qui sert le **catalogue public** : les
 * deux ne s'adressent ni aux mêmes routes, ni au même public. Les mêler
 * ferait importer des appels protégés dans les pages ouvertes à tous.
 *
 * **Aucun droit n'est vérifié ici.** `est_administrateur` n'est lisible nulle
 * part côté client : c'est le serveur qui refuse en 403, et l'écran se
 * contente de rendre ce refus lisible. Même patron que
 * `produit.administration.ts`.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  archiverSalle,
  recupererSallesAdministration,
  restaurerSalle,
} from './salle.api';
import type { SalleAdministration } from './salle.types';

const MESSAGE_PAR_DEFAUT = 'L’opération a échoué. Réessayez dans un instant.';

/**
 * Extrait le message de refus de l'API, ou retombe sur un générique.
 *
 * Le **403** est le cas propre à ces écrans : un salarié sans droit voit
 * l'écran (l'authentification de personnel suffit à y accéder par le menu)
 * mais se voit refuser l'écriture. Le **409** dit qu'une salle porte encore
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

export interface SallesAdministration {
  salles: SalleAdministration[];
  chargement: boolean;
  erreur: string | null;
  /** Rejoue la lecture — après une écriture, la liste doit refléter la base. */
  recharger: () => void;
}

/** Charge le catalogue complet des salles, actives **et** archivées. */
export function useSallesAdministration(): SallesAdministration {
  const [salles, setSalles] = useState<SalleAdministration[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    recupererSallesAdministration()
      .then((donnees) => actif && setSalles(donnees))
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [jeton]);

  return { salles, chargement, erreur, recharger };
}

export interface ActionsSalles {
  archiverLaSalle: (idSalle: number) => Promise<boolean>;
  restaurerLaSalle: (idSalle: number) => Promise<boolean>;
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
export function useActionsSalles(surSucces: () => void): ActionsSalles {
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
    archiverLaSalle: (id) => executer(() => archiverSalle(id)),
    restaurerLaSalle: (id) => executer(() => restaurerSalle(id)),
    envoi,
    erreur,
  };
}
