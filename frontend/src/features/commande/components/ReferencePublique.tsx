/**
 * Affichage de la référence d'une commande invitée.
 *
 * **C'est le seul chemin de retour de l'invité vers sa commande** : il n'a ni
 * compte ni jeton. La perdre revient à perdre la commande. Elle est donc
 * présentée en évidence, sélectionnable, et accompagnée de son lien direct —
 * avec un bouton pour le copier, plutôt que de compter sur une sélection à la
 * souris.
 */

import { useState } from 'react';
import { Bookmark, Check, Copy } from 'lucide-react';

import { useTextes } from '@/lib/langue';

import { TEXTES_COMMANDE } from '../commande.textes';

interface Proprietes {
  reference: string;
}

export default function ReferencePublique({ reference }: Proprietes) {
  const t = useTextes(TEXTES_COMMANDE);
  const lien = `${window.location.origin}/commandes/invite/${reference}`;
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le lien
      // reste affiché et sélectionnable, rien n'est perdu.
    }
  }

  return (
    <div className="rounded-2xl border border-attente/50 bg-attente/10 p-5">
      <h2 className="flex items-center gap-2 font-semibold text-gris-700">
        <Bookmark size={18} aria-hidden className="text-attente" />
        {t.conserverReference}
      </h2>
      <p className="mt-1 text-sm text-gris-600">{t.referenceExplication}</p>
      <code
        data-testid="reference-publique"
        className="mt-3 block select-all break-all rounded-lg border border-gris-200 bg-surface px-3 py-2 font-mono text-sm text-gris-700"
      >
        {reference}
      </code>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void copier()}
          className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium text-gris-700 shadow-sm ring-1 ring-gris-300 transition-colors hover:text-primaire hover:ring-primaire"
        >
          {copie ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copie ? t.lienCopie : t.copierLien}
        </button>
        <a href={lien} className="break-all text-xs text-gris-500 underline">
          {lien}
        </a>
      </div>
    </div>
  );
}
