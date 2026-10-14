/**
 * Hooks du module devise.
 *
 * Depuis le 14 octobre 2026, le site reste **en Ariary** de bout en bout :
 * plus de choix de devise au tunnel, plus d'écran de taux. Ne reste que le
 * formateur des prix.
 */

import { useCallback } from 'react';

import { formaterDevise } from './devise.service';

/** Formateur des prix affichés au client : toujours en Ariary. */
export function useFormaterPrix(): (montantAriary: number | string) => string {
  return useCallback(
    (montantAriary: number | string) => formaterDevise(montantAriary, 'MGA'),
    []
  );
}
