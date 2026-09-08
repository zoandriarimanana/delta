/**
 * Bouton — **primitive purement présentationnelle**.
 *
 * Aucune connaissance d'entité, aucun appel : il rend un `<button>` habillé.
 * L'état désactivé vient de l'attribut natif, et non d'une variante à part —
 * un bouton désactivé reste le même bouton, seule son apparence change.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type VarianteBouton = 'principal' | 'secondaire';

const CLASSES: Record<VarianteBouton, string> = {
  principal: 'bg-terracotta text-white shadow-sm hover:bg-burgundy',
  secondaire: 'border-2 border-terracotta text-terracotta hover:bg-warm-gray-100',
};

interface Proprietes extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton;
  children: ReactNode;
}

export default function Bouton({
  variante = 'principal',
  className = '',
  disabled,
  children,
  ...reste
}: Proprietes) {
  // Les classes désactivées **suivent** celles de la variante : elles doivent
  // l'emporter, sans quoi un bouton principal désactivé garderait sa couleur
  // pleine et paraîtrait cliquable.
  const apparence = disabled
    ? 'cursor-not-allowed bg-warm-gray-300 text-warm-gray-500 border-transparent'
    : CLASSES[variante];

  return (
    <button
      type="button"
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${apparence} ${className}`}
      {...reste}
    >
      {children}
    </button>
  );
}
