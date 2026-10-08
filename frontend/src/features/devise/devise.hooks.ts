/**
 * Hooks du module devise.
 *
 * Les taux sont chargés **une fois** par page et partagés : chaque prix
 * affiché ne déclenche pas sa propre requête.
 */

import { useCallback, useEffect, useState } from 'react';

import { recupererTaux } from './devise.api';
import { formaterConverti } from './devise.service';
import { useDevise } from './devise.store';
import type { TauxChange } from './devise.types';

let enCache: TauxChange[] | null = null;
let enCours: Promise<TauxChange[]> | null = null;
const abonnes = new Set<(taux: TauxChange[]) => void>();

function charger(): Promise<TauxChange[]> {
  if (enCours === null) {
    enCours = recupererTaux()
      .then((taux) => {
        enCache = taux;
        abonnes.forEach((notifier) => notifier(taux));
        return taux;
      })
      .catch(() => {
        // Sans taux, les prix restent en Ariary ; on réessaiera plus tard.
        enCours = null;
        return [];
      });
  }
  return enCours;
}

/** Oublie les taux en cache — après un réglage administrateur, et en test. */
export function oublierTaux(): void {
  enCache = null;
  enCours = null;
}

/** Taux courants (liste vide tant qu'ils ne sont pas arrivés). */
export function useTaux(): TauxChange[] {
  const [taux, setTaux] = useState<TauxChange[]>(enCache ?? []);
  useEffect(() => {
    abonnes.add(setTaux);
    if (enCache === null) void charger();
    else setTaux(enCache);
    return () => {
      abonnes.delete(setTaux);
    };
  }, []);
  return taux;
}

/**
 * Formateur des prix du catalogue dans la devise choisie par le visiteur.
 * Retombe sur l'Ariary tant que le taux n'est pas connu.
 */
export function useFormaterPrix(): (montantAriary: number | string) => string {
  const devise = useDevise();
  const taux = useTaux();
  return useCallback(
    (montantAriary: number | string) => formaterConverti(montantAriary, devise, taux),
    [devise, taux]
  );
}
