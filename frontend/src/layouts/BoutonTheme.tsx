/**
 * Interrupteur clair / sombre, monté par les deux layouts.
 *
 * L'icône montre le mode **vers lequel** on bascule (lune en clair, soleil
 * en sombre), et le nom accessible le dit en toutes lettres.
 */

import { Moon, Sun } from 'lucide-react';

import { useTheme } from '@/lib/theme';

interface Proprietes {
  /** Avec libellé visible (barre latérale) ou icône seule (en-tête). */
  avecLibelle?: boolean;
  className?: string;
}

export default function BoutonTheme({
  avecLibelle = false,
  className = '',
}: Proprietes) {
  const { theme, basculer } = useTheme();
  const versSombre = theme === 'clair';
  const libelle = versSombre ? 'Activer le mode sombre' : 'Activer le mode clair';
  const Icone = versSombre ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={libelle}
      title={libelle}
      className={`flex items-center gap-3 rounded-full p-2.5 text-gris-700 transition-colors hover:bg-gris-100 hover:text-primaire ${className}`}
    >
      <Icone size={20} aria-hidden />
      {avecLibelle && (
        <span className="text-sm font-medium">
          {versSombre ? 'Mode sombre' : 'Mode clair'}
        </span>
      )}
    </button>
  );
}
