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
 * **L'état d'échec se réinitialise à chaque changement de `src`** (bug trouvé
 * lors du test manuel de l'aperçu de sélection : sans ce `useEffect`, une
 * première URL en échec — le cas courant à la création, avant tout choix de
 * fichier, `GET /personnel/0/photo` répondant 404 — verrouillait le repli
 * pour de bon, y compris une fois `src` changé pour une URL locale
 * (`URL.createObjectURL`) parfaitement valide). Un changement de `src` est
 * un fait nouveau, jamais une raison de rester sur le refus précédent.
 *
 * Cas **distinct**, non couvert par ce qui précède : remplacer une photo
 * *côté serveur* ne change **pas** l'URL (`/personnel/{id}/photo` reste la
 * même chaîne) — sans changement de `src`, ce `useEffect` ne se déclenche
 * pas, et le navigateur ne referait même pas la requête. C'est pour ce
 * second cas, et lui seul, que l'appelant doit encore forcer un remontage en
 * changeant la `key` de l'élément (voir `PersonnelDetailAdministrationPage`).
 */

import { useEffect, useState } from 'react';
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

  // Un nouveau `src` mérite une nouvelle chance, quel que soit le sort du
  // précédent — voir la docstring du fichier.
  useEffect(() => {
    setEnEchec(false);
  }, [src]);

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
