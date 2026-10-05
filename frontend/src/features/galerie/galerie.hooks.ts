/** Hooks du module galerie : état, effets, et rien de visuel. */

import { useCallback, useEffect, useState } from 'react';

import { ajouterPhoto, recupererPhotos, supprimerPhoto } from './galerie.api';
import type { BienPhotographie, PhotoBien } from './galerie.types';

export interface Galerie {
  photos: PhotoBien[];
  chargement: boolean;
  /** `true` si la galerie n'a pas pu être lue — la fiche reste utilisable. */
  erreur: boolean;
  recharger: () => void;
}

/**
 * Galerie d'un bien. `null` désactive la requête.
 *
 * Le bien est décomposé (`salle`, `logement`, `formation`) avant l'effet :
 * un objet recréé à chaque rendu relancerait la requête en boucle.
 */
export function useGalerie(bien: BienPhotographie | null): Galerie {
  const idSalle = bien !== null && 'salle' in bien ? bien.salle : null;
  const idLogement = bien !== null && 'logement' in bien ? bien.logement : null;
  const idFormation = bien !== null && 'formation' in bien ? bien.formation : null;
  const [photos, setPhotos] = useState<PhotoBien[]>([]);
  const [chargement, setChargement] = useState(bien !== null);
  const [erreur, setErreur] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const cible: BienPhotographie | null =
      idSalle !== null
        ? { salle: idSalle }
        : idLogement !== null
          ? { logement: idLogement }
          : idFormation !== null
            ? { formation: idFormation }
            : null;
    if (cible === null) {
      setPhotos([]);
      setChargement(false);
      return;
    }
    let actif = true;
    setChargement(true);
    setErreur(false);
    recupererPhotos(cible)
      .then((lues) => actif && setPhotos(lues))
      .catch(() => {
        if (actif) {
          setPhotos([]);
          setErreur(true);
        }
      })
      .finally(() => actif && setChargement(false));
    return () => {
      actif = false;
    };
  }, [idSalle, idLogement, idFormation, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return { photos, chargement, erreur, recharger };
}

const MESSAGE_PAR_DEFAUT = 'L’opération a échoué. Réessayez dans un instant.';

function message(erreurCapturee: unknown): string {
  const reponse = (
    erreurCapturee as {
      response?: { status?: number; data?: { detail?: unknown } };
    } | null
  )?.response;
  if (reponse?.status === 403) {
    return 'Cette action est réservée aux administrateurs.';
  }
  // Repris tel quel : « JPEG, PNG et WebP », « 5 Mio », « déjà 10 photos »
  // disent quoi corriger. Une liste (erreur de schema) retombe sur le défaut.
  const detail = reponse?.data?.detail;
  return typeof detail === 'string' && detail.length > 0 ? detail : MESSAGE_PAR_DEFAUT;
}

export interface GestionGalerie {
  ajouter: (fichier: File, legende: string) => Promise<boolean>;
  retirer: (idPhoto: number) => Promise<void>;
  envoi: boolean;
  erreur: string | null;
}

/** Écritures de l'administration ; `apres` recharge la galerie affichée. */
export function useGestionGalerie(
  bien: BienPhotographie,
  apres: () => void
): GestionGalerie {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function executer(action: () => Promise<unknown>): Promise<boolean> {
    setEnvoi(true);
    setErreur(null);
    try {
      await action();
      apres();
      return true;
    } catch (erreurCapturee) {
      setErreur(message(erreurCapturee));
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  return {
    ajouter: (fichier, legende) => executer(() => ajouterPhoto(bien, fichier, legende)),
    retirer: async (idPhoto) => {
      await executer(() => supprimerPhoto(idPhoto));
    },
    envoi,
    erreur,
  };
}
