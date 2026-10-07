/**
 * Logo Delta — **primitive purement présentationnelle**.
 *
 * Elle ne connaît aucune entité : c'est l'identité visuelle du site, montée
 * par les layouts. Le logo d'origine (`logo_delta.jpg`, carré, fond blanc) est
 * décliné en trois images à fond transparent, générées depuis lui sans
 * retouche de forme ni de couleur : le symbole, le mot « DELTA », et le logo
 * complet.
 *
 * En-tête : symbole et mot **côte à côte**, plutôt que le logo carré — dans
 * une barre de navigation horizontale, le mot y resterait illisible.
 */

import logoComplet from '@/assets/logo-delta.png';
import logoSymbole from '@/assets/logo-delta-symbole.png';
import logoTexte from '@/assets/logo-delta-texte.png';

export type FormeLogo = 'horizontal' | 'symbole' | 'complet';

const HAUTEURS = {
  horizontal: 'h-10',
  symbole: 'h-8',
  complet: 'h-24',
} as const;

interface Proprietes {
  forme?: FormeLogo;
  className?: string;
}

export default function LogoDelta({
  forme = 'horizontal',
  className = '',
}: Proprietes) {
  if (forme === 'complet') {
    return (
      <img
        src={logoComplet}
        alt="Delta"
        className={`${HAUTEURS.complet} w-auto ${className}`}
      />
    );
  }
  if (forme === 'symbole') {
    return (
      <img
        src={logoSymbole}
        alt="Delta"
        className={`${HAUTEURS.symbole} w-auto ${className}`}
      />
    );
  }
  return (
    // Un seul nom accessible, « Delta » : le symbole est décoratif à côté du mot.
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={logoSymbole} alt="" className={`${HAUTEURS.horizontal} w-auto`} />
      <img src={logoTexte} alt="Delta" className="h-5 w-auto" />
    </span>
  );
}
