/**
 * Hooks et règles de l'administration du personnel.
 *
 * **Aucun droit n'est vérifié ici.** `est_administrateur` n'est lisible nulle
 * part côté client : c'est le serveur qui refuse en 403, et l'écran se
 * contente de rendre ce refus lisible (cf. `produit.administration.ts`, même
 * traitement).
 */

import { useCallback, useEffect, useState } from 'react';

import { creerPersonnel, listerPersonnel, obtenirPersonnel } from './personnel.api';
import type { FonctionPersonnel, Personnel, PersonnelEnvoye } from './personnel.types';

const MESSAGE_PAR_DEFAUT = 'L’opération a échoué. Réessayez dans un instant.';

/**
 * Extrait le message de refus de l'API, ou retombe sur un générique.
 *
 * Le **403** est le cas propre à ces écrans : un salarié sans droit voit
 * l'annuaire (lecture ouverte à tout salarié) mais se voit refuser
 * l'écriture. Le message doit dire qu'il lui manque un droit — ni une panne,
 * ni une session expirée, que sa reconnexion ne réglerait pas.
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

export interface AnnuaireAdministration {
  personnels: Personnel[];
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/** Personnel actif, filtré par fonction côté serveur si demandé. */
export function useAnnuairePersonnel(
  fonction: FonctionPersonnel | ''
): AnnuaireAdministration {
  const [personnels, setPersonnels] = useState<Personnel[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    listerPersonnel(fonction === '' ? undefined : fonction)
      .then((donnees) => actif && setPersonnels(donnees))
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [fonction, jeton]);

  return { personnels, chargement, erreur, recharger };
}

export interface CreationPersonnel {
  /** `null` en cas d'échec — sinon le membre créé, dont l'identifiant sert à
   * téléverser sa photo juste après (cf. `AdministrationPersonnelPage`). */
  creerUnMembre: (donnees: PersonnelEnvoye) => Promise<Personnel | null>;
  envoi: boolean;
  erreur: string | null;
}

/**
 * Création d'un membre du personnel, depuis la liste.
 *
 * **Modifier, archiver, restaurer et anonymiser n'y figurent pas** — ces
 * actions vivent dans `PersonnelDetailAdministrationPage`, en état local :
 * `GET /personnel/{id}` ne renvoie jamais une ligne tout juste archivée ou
 * anonymisée (pas de paramètre `inclure_supprimes` exposé), donc les
 * recharger via un hook générique retomberait sur un 404. La fiche garde
 * elle-même la dernière donnée connue plutôt que de la relire — inutile de
 * dupliquer ce mécanisme ici pour une création, qui n'a pas ce problème.
 */
export function useCreerPersonnel(surSucces: () => void): CreationPersonnel {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const creerUnMembre = useCallback(
    async (donnees: PersonnelEnvoye): Promise<Personnel | null> => {
      setEnvoi(true);
      setErreur(null);
      try {
        const cree = await creerPersonnel(donnees);
        surSucces();
        return cree;
      } catch (erreurAppel) {
        setErreur(messageDAdministration(erreurAppel));
        return null;
      } finally {
        setEnvoi(false);
      }
    },
    [surSucces]
  );

  return { creerUnMembre, envoi, erreur };
}

export interface PersonnelDetailAdministration {
  personnel: Personnel | null;
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/**
 * Fiche d'un membre du personnel — lecture seule.
 *
 * `recharger()` n'a de sens qu'après une écriture qui **laisse la ligne
 * active** (modification). Archiver, restaurer et anonymiser sont gérés
 * localement par `PersonnelDetailAdministrationPage`, qui évite d'appeler
 * `recharger()` juste après : `GET /personnel/{id}` sur une ligne devenue
 * archivée retomberait sur un 404, effaçant la donnée qu'on veut encore
 * afficher (par exemple pour l'affordance « Restaurer »).
 */
export function usePersonnelDetailAdministration(
  idPersonnel: number
): PersonnelDetailAdministration {
  const [personnel, setPersonnel] = useState<Personnel | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    obtenirPersonnel(idPersonnel)
      .then((donnees) => actif && setPersonnel(donnees))
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [idPersonnel, jeton]);

  return { personnel, chargement, erreur, recharger };
}
