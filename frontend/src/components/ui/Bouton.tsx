/**
 * Bouton — **primitive purement présentationnelle**.
 *
 * Aucune connaissance d'entité, aucun appel : il rend un `<button>` habillé.
 * L'état désactivé vient de l'attribut natif, et non d'une variante à part —
 * un bouton désactivé reste le même bouton, seule son apparence change.
 *
 * Les variantes nomment une **intention**, jamais une couleur, comme `Badge` :
 * l'administrateur doit distinguer d'un coup d'œil ce qui valide (vert), ce qui
 * détruit ou interrompt (rouge), ce qui engage de l'argent (ambre) et ce qui
 * ne fait que modifier ou ouvrir (bleu). Une barre de boutons tous identiques
 * obligeait à lire chaque libellé avant d'oser cliquer.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type VarianteBouton =
  /** L'action principale d'un écran public (orange du logo). */
  | 'principal'
  /** Ouvrir, modifier, consulter — sans effet irréversible. */
  | 'secondaire'
  /** Créer ou lancer une action positive non destructive. */
  | 'primaire'
  /** Enregistrer, confirmer, rétablir. */
  | 'valider'
  /** Annuler une réservation ou une commande, anonymiser : irréversible. */
  | 'danger'
  /** Archiver, retirer : destructif mais réversible ou mineur. */
  | 'danger-contour'
  /** Engage de l'argent ou demande de la prudence (rembourser…). */
  | 'attention'
  /** Fermer un formulaire sans rien enregistrer. */
  | 'neutre';

const CLASSES: Record<VarianteBouton, string> = {
  principal:
    'border-2 border-transparent bg-action text-white shadow-sm hover:bg-action-fonce',
  secondaire: 'border-2 border-primaire text-primaire hover:bg-primaire/10',
  primaire:
    'border-2 border-transparent bg-primaire text-sur-couleur shadow-sm hover:bg-primaire-fonce',
  valider:
    'border-2 border-transparent bg-succes text-sur-couleur shadow-sm hover:brightness-110',
  danger:
    'border-2 border-transparent bg-danger text-sur-couleur shadow-sm hover:brightness-110',
  'danger-contour': 'border-2 border-danger/60 text-danger hover:bg-danger/10',
  attention:
    'border-2 border-transparent bg-attente text-sur-couleur shadow-sm hover:brightness-110',
  neutre: 'border-2 border-gris-300 text-gris-600 hover:bg-gris-100',
};

interface Proprietes extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton;
  /** Icône décorative placée avant le libellé. */
  icone?: LucideIcon;
  children: ReactNode;
}

export default function Bouton({
  variante = 'principal',
  icone: Icone,
  className = '',
  disabled,
  children,
  ...reste
}: Proprietes) {
  // Les classes désactivées **suivent** celles de la variante : elles doivent
  // l'emporter, sans quoi un bouton principal désactivé garderait sa couleur
  // pleine et paraîtrait cliquable.
  const apparence = disabled
    ? 'cursor-not-allowed border-2 border-transparent bg-gris-300 text-gris-500'
    : CLASSES[variante];

  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${apparence} ${className}`}
      {...reste}
    >
      {Icone !== undefined && <Icone size={16} aria-hidden className="shrink-0" />}
      {children}
    </button>
  );
}
