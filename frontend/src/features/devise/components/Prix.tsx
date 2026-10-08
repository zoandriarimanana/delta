/**
 * Prix du catalogue, affiché dans la devise choisie par le visiteur.
 *
 * Le montant reçu est **toujours en Ariary** — c'est ainsi que le catalogue
 * est tenu. Hors Ariary, l'infobulle rappelle le prix d'origine : la
 * conversion est indicative jusqu'à la commande, qui fige le taux.
 */

import { formaterDevise } from '../devise.service';
import { useFormaterPrix } from '../devise.hooks';
import { useDevise } from '../devise.store';

interface Proprietes {
  /** Montant en Ariary. */
  montant: number | string;
  className?: string;
}

export default function Prix({ montant, className }: Proprietes) {
  const formater = useFormaterPrix();
  const devise = useDevise();
  return (
    <span
      className={className}
      title={devise === 'MGA' ? undefined : formaterDevise(montant, 'MGA')}
    >
      {formater(montant)}
    </span>
  );
}
