/** Un champ d’une fiche d’administration : intitulé, puis valeur. Primitive visuelle. */

import type { ReactNode } from 'react';

interface Proprietes {
  intitule: string;
  children: ReactNode;
}

export default function ChampFiche({ intitule, children }: Proprietes) {
  return (
    <div>
      <dt className="text-sm text-gris-500">{intitule}</dt>
      <dd className="text-gris-700">{children}</dd>
    </div>
  );
}
