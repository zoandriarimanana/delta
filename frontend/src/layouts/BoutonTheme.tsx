/**
 * Interrupteur clair / sombre, monté par les deux layouts.
 *
 * L'icône montre le mode **vers lequel** on bascule (lune en clair, soleil
 * en sombre), et le nom accessible le dit en toutes lettres.
 */

import { Moon, Sun } from 'lucide-react';

import { useTextes } from '@/lib/langue';
import { useTheme } from '@/lib/theme';

import { TEXTES_LAYOUT } from './layout.textes';

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
  const t = useTextes(TEXTES_LAYOUT);
  const libelle = versSombre ? t.activerSombre : t.activerClair;
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
          {versSombre ? t.modeSombre : t.modeClair}
        </span>
      )}
    </button>
  );
}
