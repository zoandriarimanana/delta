/** Hooks du module salle : état, effets, et rien de visuel. */

import { useCallback, useEffect, useState } from 'react';

import { recupererSalle, recupererSalles } from './salle.api';
import type { Salle } from './salle.types';

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

/**
 * Catalogue des salles, filtré par capacité si demandé.
 *
 * `null` signifie « toutes les capacités » — pas « aucune ». Une capacité
 * qu'aucune salle n'atteint donne une liste vide côté serveur, pas une erreur.
 */
export function useSalles(capaciteMinimale: number | null): EtatAsynchrone<Salle[]> {
  return useRequete(
    useCallback(
      () => recupererSalles(capaciteMinimale === null ? undefined : capaciteMinimale),
      [capaciteMinimale]
    )
  );
}

/** Fiche d'une salle. `null` désactive la requête. */
export function useSalle(idSalle: number | null): EtatAsynchrone<Salle> {
  return useRequete(
    useCallback(() => recupererSalle(idSalle as number), [idSalle]),
    idSalle !== null
  );
}
