/**
 * Prix du catalogue, toujours affiché en Ariary — c'est ainsi que le
 * catalogue est tenu, et ce que le client lit partout (12 octobre 2026).
 */

import { useFormaterPrix } from '../devise.hooks';

interface Proprietes {
  /** Montant en Ariary. */
  montant: number | string;
  className?: string;
}

export default function Prix({ montant, className }: Proprietes) {
  const formater = useFormaterPrix();
  return <span className={className}>{formater(montant)}</span>;
}
