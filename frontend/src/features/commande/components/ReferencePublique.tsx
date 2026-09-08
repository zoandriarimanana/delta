/**
 * Affichage de la référence d'une commande invitée.
 *
 * **C'est le seul chemin de retour de l'invité vers sa commande** : il n'a ni
 * compte ni jeton. La perdre revient à perdre la commande. Elle est donc
 * présentée en évidence, sélectionnable, et accompagnée de son lien direct —
 * l'invité peut mettre la page en favori plutôt que recopier un UUID.
 */

interface Proprietes {
  reference: string;
}

export default function ReferencePublique({ reference }: Proprietes) {
  const lien = `${window.location.origin}/commandes/invite/${reference}`;

  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-4">
      <h2 className="font-semibold text-amber-900">Conservez cette référence</h2>
      <p className="mt-1 text-sm text-amber-900">
        Vous avez commandé sans compte : c’est le seul moyen de retrouver votre
        commande.
      </p>
      <code
        data-testid="reference-publique"
        className="mt-3 block select-all break-all rounded bg-white px-3 py-2 font-mono text-sm text-slate-900"
      >
        {reference}
      </code>
      <a
        href={lien}
        className="mt-3 inline-block break-all text-sm text-amber-900 underline"
      >
        {lien}
      </a>
    </div>
  );
}
