/**
 * Hooks et règles de l'administration du module formation.
 *
 * Fichier distinct de `formation.hooks.ts`, qui sert le **catalogue public** :
 * les deux ne s'adressent ni aux mêmes routes, ni au même public. Les mêler
 * ferait importer des appels protégés dans les pages ouvertes à tous.
 *
 * **Un seul fichier pour les trois entités du module** (`DOMAINE_FORMATION`,
 * `FORMATION`, `SESSION_FORMATION`), comme `formation.types.ts` et
 * `formation.api.ts` le sont déjà : même découpage que le module `produit`
 * (`produit.administration.ts` couvre `PRODUIT` et `CATEGORIE_PRODUIT`). Ce
 * fichier grandit au fil des trois tâches du chantier ; la partie
 * `SESSION_FORMATION` reste à ajouter.
 *
 * **Aucun droit n'est vérifié ici.** `est_administrateur` n'est lisible nulle
 * part côté client : c'est le serveur qui refuse en 403, et l'écran se
 * contente de rendre ce refus lisible.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  archiverDomaine,
  archiverFormation,
  recupererDomainesAdministration,
  recupererFormationsAdministration,
  restaurerDomaine,
  restaurerFormation,
} from './formation.api';
import type {
  DomaineFormationAdministration,
  FormationAdministration,
} from './formation.types';

const MESSAGE_PAR_DEFAUT = 'L’opération a échoué. Réessayez dans un instant.';

/**
 * Extrait le message de refus de l'API, ou retombe sur un générique.
 *
 * Le **403** est le cas propre à ces écrans : un salarié sans droit voit
 * l'écran (l'authentification de personnel suffit à y accéder par le menu)
 * mais se voit refuser l'écriture. Les refus **409** — domaine encore peuplé,
 * libellé repris par un domaine actif — sont repris tels quels : ils disent
 * exactement quoi corriger.
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

export interface DomainesAdministration {
  domaines: DomaineFormationAdministration[];
  chargement: boolean;
  erreur: string | null;
  /** Rejoue la lecture — après une écriture, la liste doit refléter la base. */
  recharger: () => void;
}

/** Charge le catalogue complet des domaines, actifs **et** archivés. */
export function useDomainesAdministration(): DomainesAdministration {
  const [domaines, setDomaines] = useState<DomaineFormationAdministration[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    recupererDomainesAdministration()
      .then((donnees) => actif && setDomaines(donnees))
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [jeton]);

  return { domaines, chargement, erreur, recharger };
}

export interface ActionsDomaines {
  archiverLeDomaine: (idDomaine: number) => Promise<boolean>;
  restaurerLeDomaine: (idDomaine: number) => Promise<boolean>;
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
export function useActionsDomaines(surSucces: () => void): ActionsDomaines {
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
    archiverLeDomaine: (id) => executer(() => archiverDomaine(id)),
    restaurerLeDomaine: (id) => executer(() => restaurerDomaine(id)),
    envoi,
    erreur,
  };
}

// --- FORMATION ------------------------------------------------------------

export interface FormationsAdministration {
  formations: FormationAdministration[];
  chargement: boolean;
  erreur: string | null;
  /** Rejoue la lecture — après une écriture, la liste doit refléter la base. */
  recharger: () => void;
}

/** Charge le catalogue complet des formations, actives **et** archivées. */
export function useFormationsAdministration(): FormationsAdministration {
  const [formations, setFormations] = useState<FormationAdministration[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    recupererFormationsAdministration()
      .then((donnees) => actif && setFormations(donnees))
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [jeton]);

  return { formations, chargement, erreur, recharger };
}

export interface FormationDetailAdministration {
  formation: FormationAdministration | null;
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/**
 * Fiche d'une formation — dérivée de la liste d'administration.
 *
 * **Pas de `GET /formations/administration/{id}`** : contrairement à
 * `ABONNEMENT`, cette route n'existe pas pour `FORMATION`. Appeler
 * `GET /formations/{id}` (public) à la place échouerait en 404 sur une
 * formation archivée — exactement le cas que la fiche doit pourtant savoir
 * afficher (pour l'affordance « Restaurer »). Réutiliser la liste complète
 * évite ce piège, au prix d'une lecture un peu plus large que nécessaire.
 */
export function useFormationDetailAdministration(
  idFormation: number
): FormationDetailAdministration {
  const catalogue = useFormationsAdministration();
  const formation =
    catalogue.formations.find((f) => f.id_formation === idFormation) ?? null;

  return {
    formation,
    chargement: catalogue.chargement,
    erreur: catalogue.erreur,
    recharger: catalogue.recharger,
  };
}

export interface ActionsFormations {
  archiverLaFormation: (idFormation: number) => Promise<boolean>;
  restaurerLaFormation: (idFormation: number) => Promise<boolean>;
  envoi: boolean;
  erreur: string | null;
}

/** Archivage et restauration — voir `useActionsDomaines`, même patron. */
export function useActionsFormations(surSucces: () => void): ActionsFormations {
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
    archiverLaFormation: (id) => executer(() => archiverFormation(id)),
    restaurerLaFormation: (id) => executer(() => restaurerFormation(id)),
    envoi,
    erreur,
  };
}
