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

interface Proprietes {
  reference: string;
}

export default function ReferencePublique({ reference }: Proprietes) {
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
    <div className="rounded-2xl border border-amber/50 bg-amber/10 p-5">
      <h2 className="flex items-center gap-2 font-semibold text-warm-gray-700">
        <Bookmark size={18} aria-hidden className="text-amber" />
        Conservez cette référence
      </h2>
      <p className="mt-1 text-sm text-warm-gray-600">
        Vous avez commandé sans compte : c’est le seul moyen de retrouver votre
        commande. Ajoutez cette page à vos favoris ou copiez son lien.
      </p>
      <code
        data-testid="reference-publique"
        className="mt-3 block select-all break-all rounded-lg border border-warm-gray-200 bg-white px-3 py-2 font-mono text-sm text-warm-gray-700"
      >
        {reference}
      </code>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void copier()}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-warm-gray-700 shadow-sm ring-1 ring-warm-gray-300 transition-colors hover:text-terracotta hover:ring-terracotta"
        >
          {copie ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copie ? 'Lien copié' : 'Copier le lien'}
        </button>
        <a href={lien} className="break-all text-xs text-warm-gray-500 underline">
          {lien}
        </a>
      </div>
    </div>
  );
}
