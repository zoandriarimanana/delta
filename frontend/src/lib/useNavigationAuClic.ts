/**
 * Rend une ligne de liste cliquable : un clic sur la ligne mène à sa fiche.
 *
 * Un hook dans `lib/` plutôt qu'une primitive de `components/ui/` : il ne
 * dessine rien, il ajoute un comportement, et sert aussi bien une ligne de
 * tableau (`<tr>`) qu'un élément de liste (`<li>`).
 *
 * **Un clic sur un élément interactif de la ligne garde son propre effet** —
 * « Modifier », « Archiver », un lien, un champ : la ligne ne navigue que si
 * le clic n'est tombé sur aucun d'eux. Le nom de l'élément reste par ailleurs
 * un vrai lien, pour le clavier et les lecteurs d'écran : la ligne cliquable
 * n'est qu'un raccourci pour la souris.
 */

import { useCallback, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';

const ELEMENTS_INTERACTIFS =
  'a, button, input, select, textarea, label, [role="button"]';

/** Classes à poser sur la ligne : curseur et survol. */
export const CLASSES_LIGNE_CLIQUABLE = 'cursor-pointer hover:bg-fond';

export function useNavigationAuClic(): (
  chemin: string
) => (evenement: MouseEvent<HTMLElement>) => void {
  const naviguer = useNavigate();

  return useCallback(
    (chemin: string) => (evenement: MouseEvent<HTMLElement>) => {
      const cible = evenement.target as HTMLElement;
      if (cible.closest(ELEMENTS_INTERACTIFS) !== null) {
        return;
      }
      // Un texte en cours de sélection n'est pas un clic de navigation.
      if ((window.getSelection()?.toString() ?? '') !== '') {
        return;
      }
      naviguer(chemin);
    },
    [naviguer]
  );
}
