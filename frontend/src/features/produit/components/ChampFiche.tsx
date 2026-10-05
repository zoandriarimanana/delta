/** Un champ d'une fiche d'administration : intitulé, puis valeur. */

import type { ReactNode } from 'react';

interface Proprietes {
  intitule: string;
  children: ReactNode;
}

export default function ChampFiche({ intitule, children }: Proprietes) {
  return (
    <div>
      <dt className="text-sm text-warm-gray-500">{intitule}</dt>
      <dd className="text-warm-gray-700">{children}</dd>
    </div>
  );
}
