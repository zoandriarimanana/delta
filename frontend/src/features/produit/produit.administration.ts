/**
 * Hooks et règles de l'administration du catalogue.
 *
 * Fichier distinct de `produit.hooks.ts`, qui sert le **catalogue public** :
 * les deux ne s'adressent ni aux mêmes routes, ni au même public. Les mêler
 * ferait importer des appels protégés dans les pages ouvertes à tous.
 *
 * **Aucun droit n'est vérifié ici.** `est_administrateur` n'est lisible nulle
 * part côté client : c'est le serveur qui refuse en 403, et l'écran se contente
 * de rendre ce refus lisible.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  archiverCategorie,
  archiverProduit,
  recupererCategoriesAdministration,
  recupererProduitsAdministration,
  restaurerCategorie,
  restaurerProduit,
} from './produit.api';
import type {
  CategorieProduitAdministration,
  ProduitAdministration,
} from './produit.types';

const MESSAGE_PAR_DEFAUT = 'L’opération a échoué. Réessayez dans un instant.';

/**
 * Extrait le message de refus de l'API, ou retombe sur un générique.
 *
 * Les refus du catalogue portent une information **actionnable** :
 *
 * - « Cette catégorie contient encore des produits. » — archiver les produits
 *   d'abord, ou les déplacer ;
 * - « Une catégorie active porte déjà ce libellé, restauration impossible. » —
 *   renommer l'autre, ou renoncer.
 *
 * Les remplacer par un message générique ferait perdre exactement ce qui permet
 * de corriger. Même traitement que les refus de réservation et de commande.
 *
 * Le **403** est le cas propre à ces écrans : `est_administrateur` n'étant
 * lisible nulle part côté client, un salarié sans droit voit l'écran et se voit
 * refuser l'écriture. Le message doit dire qu'il lui manque un droit — ni une
 * panne, ni une session expirée, que sa reconnexion ne réglerait pas.
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

export interface CatalogueAdministration {
  produits: ProduitAdministration[];
  categories: CategorieProduitAdministration[];
  chargement: boolean;
  erreur: string | null;
  /** Rejoue les deux lectures — après une écriture, la liste doit refléter la base. */
  recharger: () => void;
}

/**
 * Charge le catalogue complet, actifs **et** archivés.
 *
 * Les deux listes ensemble : le formulaire produit a besoin des catégories, et
 * la liste affiche le libellé de chacune. Deux hooks séparés obligeraient
 * chaque écran à les recoller.
 */
export function useCatalogueAdministration(): CatalogueAdministration {
  const [produits, setProduits] = useState<ProduitAdministration[]>([]);
  const [categories, setCategories] = useState<CategorieProduitAdministration[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);

  const recharger = useCallback(() => setJeton((n) => n + 1), []);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);

    Promise.all([
      recupererProduitsAdministration(),
      recupererCategoriesAdministration(),
    ])
      .then(([p, c]) => {
        if (!actif) return;
        setProduits(p);
        setCategories(c);
      })
      .catch((erreurAppel) => actif && setErreur(messageDAdministration(erreurAppel)))
      .finally(() => actif && setChargement(false));

    return () => {
      actif = false;
    };
  }, [jeton]);

  return { produits, categories, chargement, erreur, recharger };
}

export interface ActionCatalogue {
  archiverLeProduit: (idProduit: number) => Promise<boolean>;
  restaurerLeProduit: (idProduit: number) => Promise<boolean>;
  archiverLaCategorie: (idCategorie: number) => Promise<boolean>;
  restaurerLaCategorie: (idCategorie: number) => Promise<boolean>;
  envoi: boolean;
  erreur: string | null;
}

/**
 * Archivage et restauration, pour les deux entités.
 *
 * **« Archiver » et non « supprimer »** : `DELETE` pose `supprime_le`, aucun
 * `DELETE` SQL n'est émis et `supprimer_definitivement` n'est exposé nulle
 * part. Nommer autrement promettrait un effacement qui n'a pas lieu.
 *
 * Les quatre actions partagent une implémentation : elles ne diffèrent que par
 * l'appel. Quatre copies divergeraient au jour où le traitement des refus
 * serait corrigé sur l'une — c'est arrivé sur la règle d'échec de connexion en
 * #63.
 */
export function useActionsCatalogue(surSucces: () => void): ActionCatalogue {
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
    archiverLeProduit: (id) => executer(() => archiverProduit(id)),
    restaurerLeProduit: (id) => executer(() => restaurerProduit(id)),
    archiverLaCategorie: (id) => executer(() => archiverCategorie(id)),
    restaurerLaCategorie: (id) => executer(() => restaurerCategorie(id)),
    envoi,
    erreur,
  };
}
