/**
 * Choix de la devise d'affichage, dans l'en-tête public.
 *
 * Un `<select>` natif : accessible au clavier et lisible par les lecteurs
 * d'écran sans rien réinventer, et compact sur mobile.
 */

import { DEVISES, SYMBOLES_DEVISES } from '../devise.service';
import { definirDevise, useDevise } from '../devise.store';
import type { Devise } from '../devise.types';

export default function SelecteurDevise({ className = '' }: { className?: string }) {
  const devise = useDevise();
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">Devise</span>
      <select
        value={devise}
        onChange={(e) => definirDevise(e.target.value as Devise)}
        className="cursor-pointer appearance-none rounded-full border border-gris-300 bg-surface py-1.5 pl-3 pr-3 text-sm font-medium text-gris-700 hover:border-primaire focus:border-primaire focus:outline-none focus:ring-2 focus:ring-primaire/20"
      >
        {DEVISES.map((valeur) => (
          <option key={valeur} value={valeur}>
            {SYMBOLES_DEVISES[valeur]} {valeur}
          </option>
        ))}
      </select>
    </label>
  );
}
