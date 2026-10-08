/**
 * Bascule de langue FR / EN, dans l'en-tête public.
 *
 * Affiche la langue **vers laquelle** on bascule — comme le bouton de thème
 * montre le mode qu'il active —, et son nom accessible est rédigé dans cette
 * langue cible : un visiteur qui ne lit pas la langue courante doit pouvoir
 * la quitter.
 */

import { Languages } from 'lucide-react';

import { definirLangue, useLangue, useTextes } from '@/lib/langue';

import { TEXTES_LAYOUT } from './layout.textes';

export default function BoutonLangue({ className = '' }: { className?: string }) {
  const langue = useLangue();
  const t = useTextes(TEXTES_LAYOUT);
  const cible = langue === 'fr' ? 'en' : 'fr';
  return (
    <button
      type="button"
      onClick={() => definirLangue(cible)}
      aria-label={t.basculerLangue}
      title={t.basculerLangue}
      lang={cible}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-sm font-semibold text-gris-700 transition-colors hover:bg-gris-100 hover:text-primaire ${className}`}
    >
      <Languages size={18} aria-hidden />
      {cible.toUpperCase()}
    </button>
  );
}
