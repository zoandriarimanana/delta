/**
 * Choix de la devise de paiement, au tunnel de commande.
 *
 * Ne change **pas** l'affichage des prix, toujours en Ariary : hors Ariary,
 * il indique seulement le montant converti. Il rappelle aussi les deux faits
 * qui engagent le client : le taux est figé à la validation, et le paiement
 * se fait par carte bancaire internationale (le mobile money n'opère qu'en
 * Ariary).
 */

import { CreditCard } from 'lucide-react';

import { useTextes } from '@/lib/langue';

import { useConversionIndicative } from '../devise.hooks';
import { TEXTES_DEVISE } from '../devise.textes';
import { DEVISES, SYMBOLES_DEVISES } from '../devise.service';
import { definirDevise, useDevise } from '../devise.store';

interface Proprietes {
  /** Total indicatif de la commande, en Ariary. */
  totalAriary: number;
}

export default function ChoixDevise({ totalAriary }: Proprietes) {
  const t = useTextes(TEXTES_DEVISE);
  const devise = useDevise();
  const converti = useConversionIndicative(totalAriary, devise);
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gris-700">{t.payerEn}</legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {DEVISES.map((valeur) => {
          const actif = valeur === devise;
          return (
            <label
              key={valeur}
              className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border-2 px-2 py-2 text-sm font-semibold transition-colors ${
                actif
                  ? 'border-primaire bg-primaire/10 text-primaire'
                  : 'border-gris-200 text-gris-600 hover:border-gris-300'
              }`}
            >
              <input
                type="radio"
                name="devise-paiement"
                value={valeur}
                checked={actif}
                onChange={() => definirDevise(valeur)}
                className="sr-only"
              />
              {SYMBOLES_DEVISES[valeur]} {valeur}
            </label>
          );
        })}
      </div>
      {converti !== null && (
        <p className="mt-2 flex items-baseline justify-between rounded-lg bg-primaire/5 px-3 py-2 text-sm">
          <span className="text-gris-600">{t.soitEnviron}</span>
          <span className="font-semibold text-primaire">{converti}</span>
        </p>
      )}
      {devise !== 'MGA' && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-gris-500">
          <CreditCard size={14} aria-hidden className="mt-0.5 shrink-0" />
          {t.noteDevise}
        </p>
      )}
    </fieldset>
  );
}
