/**
 * Hooks du module formation : état, effets, et rien de visuel.
 *
 * Même triplet `donnees` / `chargement` / `erreur` que le module produit : les
 * pages n'ont qu'une seule forme d'état à traiter, et aucune ne peut « oublier »
 * le cas d'erreur, il est dans le type.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  recupererDomaines,
  recupererFormation,
  recupererFormations,
  recupererSessions,
} from './formation.api';
import type { DomaineFormation, Formation, SessionFormation } from './formation.types';

export interface EtatAsynchrone<T> {
  donnees: T | null;
  chargement: boolean;
  erreur: string | null;
}

const MESSAGE_ERREUR_PAR_DEFAUT = 'Le chargement a échoué. Réessayez dans un instant.';

/**
 * Exécute une requête et en suit l'état.
 *
 * `charger` doit être mémoïsée par l'appelant : c'est elle qui porte les
 * dépendances réelles de la requête. Les déclarer chez l'appelant les rend
 * statiques, donc vérifiables par `exhaustive-deps`.
 */
function useRequete<T>(charger: () => Promise<T>, activee = true): EtatAsynchrone<T> {
  const [etat, setEtat] = useState<EtatAsynchrone<T>>({
    donnees: null,
    chargement: activee,
    erreur: null,
  });

  useEffect(() => {
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

/** Domaines de formation, pour le filtre du catalogue. */
export function useDomaines(): EtatAsynchrone<DomaineFormation[]> {
  return useRequete(useCallback(() => recupererDomaines(), []));
}

/**
 * Catalogue, filtré par domaine si un identifiant est fourni.
 *
 * `null` signifie « tous les domaines » — pas « aucun ». Le filtre est un
 * critère de recherche, et un domaine sans formation donne une liste vide côté
 * serveur, pas une erreur.
 */
export function useFormations(idDomaine: number | null): EtatAsynchrone<Formation[]> {
  return useRequete(
    useCallback(
      () => recupererFormations(idDomaine === null ? undefined : idDomaine),
      [idDomaine]
    )
  );
}

/** Fiche d'une formation. `null` désactive la requête. */
export function useFormation(idFormation: number | null): EtatAsynchrone<Formation> {
  return useRequete(
    useCallback(() => recupererFormation(idFormation as number), [idFormation]),
    idFormation !== null
  );
}

/** Sessions d'une formation. `null` désactive la requête. */
export function useSessions(
  idFormation: number | null
): EtatAsynchrone<SessionFormation[]> {
  return useRequete(
    useCallback(() => recupererSessions(idFormation as number), [idFormation]),
    idFormation !== null
  );
}
