/** Hooks du module logement : état, effets, et rien de visuel. */

import { useCallback, useEffect, useState } from 'react';

import { recupererLogement, recupererLogements } from './logement.api';
import type { Logement, StatutLogement } from './logement.types';

export interface EtatAsynchrone<T> {
  donnees: T | null;
  chargement: boolean;
  erreur: string | null;
}

const MESSAGE_ERREUR_PAR_DEFAUT = 'Le chargement a échoué. Réessayez dans un instant.';

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
      .then((donnees) => actif && setEtat({ donnees, chargement: false, erreur: null }))
      .catch(
        () =>
          actif &&
          setEtat({
            donnees: null,
            chargement: false,
            erreur: MESSAGE_ERREUR_PAR_DEFAUT,
          })
      );

    return () => {
      actif = false;
    };
  }, [charger, activee]);

  return etat;
}

/** Catalogue des logements, filtré par état et par capacité. */
export function useLogements(
  statut: StatutLogement | null,
  capaciteMinimale: number | null
): EtatAsynchrone<Logement[]> {
  return useRequete(
    useCallback(
      () =>
        recupererLogements(
          statut === null ? undefined : statut,
          capaciteMinimale === null ? undefined : capaciteMinimale
        ),
      [statut, capaciteMinimale]
    )
  );
}

/** Fiche d'un logement. `null` désactive la requête. */
export function useLogement(idLogement: number | null): EtatAsynchrone<Logement> {
  return useRequete(
    useCallback(() => recupererLogement(idLogement as number), [idLogement]),
    idLogement !== null
  );
}
