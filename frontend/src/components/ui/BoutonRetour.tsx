/**
 * Lien de retour habillé en bouton — **primitive purement présentationnelle**.
 *
 * Il reçoit une destination et un libellé, et ne sait pas s'il ramène au
 * catalogue, aux salles ou aux hébergements : il passe le test d'admission de
 * `components/ui/` (`docs/architecture.md`).
 *
 * Un `<Link>` et non un `<button>` : c'est une navigation, elle doit s'ouvrir
 * dans un nouvel onglet au clic du milieu comme n'importe quel lien.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

interface Proprietes {
  vers: string;
  children: ReactNode;
}

export default function BoutonRetour({ vers, children }: Proprietes) {
  return (
    <Link
      to={vers}
      className="group inline-flex items-center gap-2 rounded-full border border-gris-300 bg-surface px-4 py-2 text-sm font-medium text-gris-700 no-underline shadow-sm transition-colors hover:border-primaire hover:text-primaire"
    >
      <ArrowLeft
        size={16}
        aria-hidden
        className="transition-transform group-hover:-translate-x-0.5"
      />
      {children}
    </Link>
  );
}
