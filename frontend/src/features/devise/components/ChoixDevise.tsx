/**
 * Choix de la devise de paiement, au tunnel de commande.
 *
 * Partage la préférence de l'en-tête (`devise.store`) : changer ici change
 * l'affichage partout, et inversement. Hors Ariary, rappelle les deux faits
 * qui engagent le client : le taux est figé à la validation, et le paiement
 * se fait par carte bancaire internationale (le mobile money n'opère qu'en
 * Ariary).
 */

import { CreditCard } from 'lucide-react';

import { DEVISES, SYMBOLES_DEVISES } from '../devise.service';
import { definirDevise, useDevise } from '../devise.store';

export default function ChoixDevise() {
  const devise = useDevise();
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gris-700">Payer en</legend>
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
      {devise !== 'MGA' && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-gris-500">
          <CreditCard size={14} aria-hidden className="mt-0.5 shrink-0" />
          Paiement par carte bancaire internationale (Visa, Mastercard, American
          Express). Montant indicatif : le taux du jour est figé à la validation.
        </p>
      )}
    </fieldset>
  );
}
