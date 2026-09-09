/**
 * Image de profil circulaire, avec repli générique — **primitive purement
 * présentationnelle**, même exception que `Badge` (cf. sa docstring) : elle
 * ne connaît aucune entité du MLD, seulement une URL et une taille.
 *
 * Le repli n'est **pas** un état d'erreur affiché : c'est le comportement
 * normal en l'absence de photo. `GET /personnel/{id}/photo` répond 404 quand
 * aucune photo n'existe (cf. `docs/architecture.md`), ce que `<img onError>`
 * traduit ici en icône générique plutôt qu'en image cassée ou en espace vide.
 *
 * Pour forcer un rechargement après un remplacement de photo (même URL,
 * fichier différent), l'appelant change la `key` de l'élément — ce composant
 * n'a pas besoin de le savoir, un remontage suffit à réinitialiser l'état
 * d'erreur.
 */

import { useState } from 'react';
import { User } from 'lucide-react';

export type TailleAvatar = 'petite' | 'grande';

interface Proprietes {
  src: string;
  alt: string;
  taille?: TailleAvatar;
}

const DIMENSIONS: Record<TailleAvatar, string> = {
  petite: 'h-10 w-10',
  grande: 'h-24 w-24',
};

const DIMENSIONS_ICONE: Record<TailleAvatar, string> = {
  petite: 'h-5 w-5',
  grande: 'h-12 w-12',
};

export default function Avatar({ src, alt, taille = 'petite' }: Proprietes) {
  const [enEchec, setEnEchec] = useState(false);

  if (enEchec) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={`inline-flex ${DIMENSIONS[taille]} shrink-0 items-center justify-center rounded-full bg-warm-gray-200 text-warm-gray-500`}
      >
        <User className={DIMENSIONS_ICONE[taille]} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setEnEchec(true)}
      className={`${DIMENSIONS[taille]} shrink-0 rounded-full object-cover`}
    />
  );
}
