/**
 * Note moyenne d'un élément, pour sa fiche d'administration.
 *
 * Générique : produit, salle et logement exposent tous `note_moyenne` et
 * `nombre_avis` sur leur seule lecture unitaire (`GET /{id}`, 8.3), qui
 * ignore les éléments archivés. Pour un élément archivé, la note n'est donc
 * pas demandée. Chaque module passe sa propre fonction de lecture : ce hook
 * ne connaît aucune entité.
 */

import { useEffect, useState } from 'react';

export interface NoteFiche {
  moyenne: string | null;
  nombre: number;
  /** Faux pour un élément archivé ou illisible : la note n'est pas calculée. */
  disponible: boolean;
}

const SANS_NOTE: NoteFiche = { moyenne: null, nombre: 0, disponible: false };

export function useNoteFiche(
  identifiant: number,
  actif: boolean,
  lire: (
    identifiant: number
  ) => Promise<{ note_moyenne: string | null; nombre_avis: number }>
): NoteFiche {
  const [note, setNote] = useState<NoteFiche>(SANS_NOTE);

  useEffect(() => {
    if (!actif || !Number.isInteger(identifiant)) {
      setNote(SANS_NOTE);
      return;
    }
    let annule = false;
    lire(identifiant)
      .then((element) => {
        if (!annule) {
          setNote({
            moyenne: element.note_moyenne,
            nombre: element.nombre_avis,
            disponible: true,
          });
        }
      })
      .catch(() => {
        if (!annule) setNote(SANS_NOTE);
      });
    return () => {
      annule = true;
    };
    // `lire` est une fonction de module, stable : la relire n'apporte rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifiant, actif]);

  // Dérivé, pas seulement remis à zéro dans l'effet : sinon, au rendu qui
  // suit un archivage, l'élément apparaîtrait archivé avec son ancienne note
  // — un rendu incohérent, attrapé par un test intermittent.
  return actif ? note : SANS_NOTE;
}
