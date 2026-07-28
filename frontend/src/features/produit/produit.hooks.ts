/**
 * Hooks du module produit : état, effets, et rien de visuel.
 *
 * Chacun expose le même triplet `donnees` / `chargement` / `erreur`. Les pages
 * n'ont donc qu'une seule forme d'état à traiter, et aucune ne peut « oublier »
 * le cas d'erreur : il est dans le type.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  recupererCategories,
  recupererProduit,
  recupererProduits,
} from './produit.api';
import { versParametreCategorie, type FiltreCategorie } from './produit.service';
import type { CategorieProduit, Produit } from './produit.types';

export interface EtatAsynchrone<T> {
  donnees: T | null;
  chargement: boolean;
  erreur: string | null;
}

const MESSAGE_ERREUR_PAR_DEFAUT = 'Le chargement a échoué. Réessayez dans un instant.';

/**
 * Exécute une requête et en suit l'état.
 *
 * `chargement` repasse à `true` à chaque nouvel appel : sans cela, un changement
 * de filtre laisserait les anciens résultats affichés sans aucun signe que la
 * liste est en train de changer.
 *
 * Une réponse arrivée après le démontage est ignorée — elle provoquerait sinon
 * une mise à jour d'état sur un composant disparu.
 */
function useRequete<T>(charger: () => Promise<T>, activee = true): EtatAsynchrone<T> {
  const [etat, setEtat] = useState<EtatAsynchrone<T>>({
    donnees: null,
    chargement: activee,
    erreur: null,
  });

  // `charger` doit être mémoïsée par l'appelant : c'est elle qui porte les
  // dépendances réelles de la requête. Les déclarer chez l'appelant plutôt
  // qu'ici les rend statiques, donc vérifiables par `exhaustive-deps` — un
  // tableau construit dynamiquement échapperait à la règle.
  useEffect(() => {
    // Requête désactivée : on n'appelle rien et on ne reste pas bloqué en
    // chargement. Le cas se présente quand l'appelant n'a pas encore de quoi
    // former une requête valide — un identifiant absent de l'URL, par exemple.
    if (!activee) {
      setEtat({ donnees: null, chargement: false, erreur: null });
      return;
    }

    let actif = true;
    setEtat({ donnees: null, chargement: true, erreur: null });

    charger()
      .then((donnees) => {
        if (actif) {
          setEtat({ donnees, chargement: false, erreur: null });
        }
      })
      .catch(() => {
        if (actif) {
          setEtat({
            donnees: null,
            chargement: false,
            erreur: MESSAGE_ERREUR_PAR_DEFAUT,
          });
        }
      });

    return () => {
      actif = false;
    };
  }, [charger, activee]);

  return etat;
}

/** Catalogue des produits, filtré par catégorie si demandé. */
export function useProduits(filtre: FiltreCategorie): EtatAsynchrone<Produit[]> {
  const parametre = versParametreCategorie(filtre);
  const charger = useCallback(() => recupererProduits(parametre), [parametre]);
  return useRequete(charger);
}

/**
 * Fiche d'un produit.
 *
 * `null` désactive la requête : la règle des hooks impose de l'appeler à chaque
 * rendu, y compris quand l'identifiant de l'URL est absent ou illisible. Sans
 * cette désactivation, un identifiant de repli partirait quand même vers l'API.
 */
export function useProduit(idProduit: number | null): EtatAsynchrone<Produit> {
  const charger = useCallback(() => recupererProduit(idProduit ?? 0), [idProduit]);
  return useRequete(charger, idProduit !== null);
}

/** Catégories, pour alimenter le filtre. */
export function useCategories(): EtatAsynchrone<CategorieProduit[]> {
  const charger = useCallback(() => recupererCategories(), []);
  return useRequete(charger);
}
