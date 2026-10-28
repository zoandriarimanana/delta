/**
 * Indique si la page a défilé au-delà d'un seuil, en pixels.
 *
 * Sert à l'en-tête de l'accueil, transparent sur la photo tant qu'on est en
 * haut de page, plein dès qu'on descend. Écoute passive : le défilement n'est
 * jamais ralenti par le gestionnaire.
 */

import { useEffect, useState } from 'react';

export function useDefilement(seuil = 24): boolean {
  const [defile, setDefile] = useState(() => window.scrollY > seuil);

  useEffect(() => {
    const surDefilement = () => setDefile(window.scrollY > seuil);
    surDefilement();
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, [seuil]);

  return defile;
}
