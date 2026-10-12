/**
 * Hooks du module devise.
 *
 * Les taux sont chargés **une fois** par page et partagés : chaque prix
 * affiché ne déclenche pas sa propre requête.
 */

import { useCallback, useEffect, useState } from 'react';

import { recupererTaux } from './devise.api';
import { convertir, formaterDevise } from './devise.service';
import type { Devise, TauxChange } from './devise.types';

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
 * Formateur des prix affichés au client : **toujours en Ariary** (demande du
 * 12 octobre 2026). La devise choisie au tunnel ne décide que du paiement ;
 * elle ne convertit plus l'affichage — sans quoi, après une commande en
 * dollars, tout le catalogue restait en dollars.
 */
export function useFormaterPrix(): (montantAriary: number | string) => string {
  return useCallback(
    (montantAriary: number | string) => formaterDevise(montantAriary, 'MGA'),
    []
  );
}

/**
 * Montant en Ariary converti dans `devise` — l'indication « soit 4,44 $ » du
 * tunnel. `null` en Ariary, ou tant que le taux n'est pas connu.
 */
export function useConversionIndicative(
  montantAriary: number,
  devise: Devise
): string | null {
  const taux = useTaux();
  if (devise === 'MGA') return null;
  const converti = convertir(montantAriary, devise, taux);
  return converti === null ? null : formaterDevise(converti, devise);
}
