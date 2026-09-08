/**
 * Carte — **primitive purement présentationnelle**.
 *
 * Elle met en forme un titre, une image et un contenu libre. Elle ne connaît
 * aucune entité : c'est l'appelant qui décide de ce qu'elle affiche.
 *
 * **Accessible au clavier quand elle est cliquable.** La version d'origine
 * posait `role="button"` et `tabIndex` sans gestionnaire clavier : la carte
 * était annoncée comme un bouton, recevait le focus, et ne réagissait qu'à la
 * souris — une promesse faite aux technologies d'assistance puis non tenue.
 * `Entrée` et `Espace` déclenchent désormais la même action que le clic.
 */

import type { KeyboardEvent, ReactNode } from 'react';

interface Proprietes {
  titre: string;
  image?: string;
  description?: string | null;
  children?: ReactNode;
  pied?: ReactNode;
  /** Rend la carte cliquable — et, avec elle, focusable et actionnable au clavier. */
  surClic?: () => void;
  className?: string;
}

export default function Carte({
  titre,
  image,
  description,
  children,
  pied,
  surClic,
  className = '',
}: Proprietes) {
  const cliquable = surClic !== undefined;

  function surTouche(evenement: KeyboardEvent<HTMLDivElement>) {
    if (evenement.key === 'Enter' || evenement.key === ' ') {
      // `preventDefault` sur Espace : sans lui, la page défile en même temps
      // que l'action se déclenche.
      evenement.preventDefault();
      surClic?.();
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-xl bg-white shadow-md transition-shadow hover:shadow-lg ${
        cliquable ? 'cursor-pointer hover:shadow-xl' : ''
      } ${className}`}
      onClick={surClic}
      onKeyDown={cliquable ? surTouche : undefined}
      role={cliquable ? 'button' : undefined}
      tabIndex={cliquable ? 0 : undefined}
    >
      {image !== undefined && (
        <div className="h-48 w-full overflow-hidden bg-warm-gray-200">
          {/* `alt` vide et non le titre : l'image est décorative, le titre est
              déjà lu juste en dessous. Le répéter ferait entendre deux fois la
              même chose à un lecteur d'écran. */}
          <img src={image} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="p-4">
        <h3 className="mb-2 text-lg font-semibold text-warm-gray-700">{titre}</h3>
        {description !== null && description !== undefined && (
          <p className="mb-3 text-sm text-warm-gray-500">{description}</p>
        )}
        {children}
      </div>

      {pied !== undefined && <div className="px-4 pb-4">{pied}</div>}
    </div>
  );
}
