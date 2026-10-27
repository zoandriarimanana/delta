/** Hooks du module galerie : état, effets, et rien de visuel. */

import { useCallback, useEffect, useState } from 'react';

import {
  ajouterPhoto,
  identifiantDe,
  partieDe,
  recupererCouvertures,
  recupererPhotos,
  urlPhotoPartie,
  supprimerPhoto,
  televerserPhotos,
} from './galerie.api';
import type { BienPhotographie, PartieCatalogue, PhotoBien } from './galerie.types';

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
 * L'élément est décomposé (`salle`, `logement`, `formation`, `produit`)
 * avant l'effet :
 * un objet recréé à chaque rendu relancerait la requête en boucle.
 */
export function useGalerie(bien: BienPhotographie | null): Galerie {
  // Une clé texte et non l'objet : un objet recréé à chaque rendu relancerait
  // la requête en boucle.
  const cle = bien === null ? null : `${partieDe(bien)}:${identifiantDe(bien)}`;
  const [photos, setPhotos] = useState<PhotoBien[]>([]);
  const [chargement, setChargement] = useState(bien !== null);
  const [erreur, setErreur] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const cible = bienDepuisCle(cle);
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
  }, [cle, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return { photos, chargement, erreur, recharger };
}

const CLES_PAR_PARTIE = {
  salles: 'salle',
  logements: 'logement',
  formations: 'formation',
  produits: 'produit',
  categories: 'categorie',
} as const;

function bienDepuisCle(cle: string | null): BienPhotographie | null {
  if (cle === null) return null;
  const [partie, identifiant] = cle.split(':');
  const nom = CLES_PAR_PARTIE[partie as keyof typeof CLES_PAR_PARTIE];
  return { [nom]: Number(identifiant) } as BienPhotographie;
}

/**
 * Première photo de chaque élément d'une partie (14 octobre 2026), pour les
 * cartes d'une liste : une seule requête, et rien en cas d'échec — la carte
 * garde alors son illustration.
 */
export function useCouvertures(partie: PartieCatalogue): Record<string, string> {
  const [couvertures, setCouvertures] = useState<Record<string, string>>({});
  useEffect(() => {
    let actif = true;
    recupererCouvertures(partie)
      .then((lues) => actif && setCouvertures(lues))
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [partie]);
  return couvertures;
}

/**
 * Image d'une carte de liste : la première photo de l'élément si
 * l'administration en a déposé, l'illustration de repli sinon — jamais un
 * cadre vide (14 octobre 2026).
 */
export function useImageCouverture(
  partie: PartieCatalogue
): (id: number, repli: string) => string {
  const couvertures = useCouvertures(partie);
  return useCallback(
    (id, repli) => {
      const fichier = couvertures[String(id)];
      return fichier === undefined ? repli : urlPhotoPartie(partie, fichier);
    },
    [couvertures, partie]
  );
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
  ajouter: (fichier: File) => Promise<boolean>;
  retirer: (nomFichier: string) => Promise<void>;
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
    ajouter: (fichier) => executer(() => ajouterPhoto(bien, fichier)),
    retirer: async (nomFichier) => {
      await executer(() => supprimerPhoto(bien, nomFichier));
    },
    envoi,
    erreur,
  };
}

/**
 * Photos choisies dans un formulaire de création (14 octobre 2026). La page
 * vérifie qu'il y en a au moins une **avant** de créer l'élément, puis les
 * envoie une fois l'identifiant connu. Un envoi refusé ne défait pas la
 * création : l'avertissement renvoie vers la fiche pour compléter.
 */
export function usePhotosCreation() {
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [avertissement, setAvertissement] = useState<string | null>(null);

  const manquantes = fichiers.length === 0 ? 'Ajoutez au moins une photo.' : null;

  const envoyer = useCallback(
    async (bien: BienPhotographie) => {
      const echecs = await televerserPhotos(bien, fichiers);
      setAvertissement(
        echecs > 0
          ? `Élément créé, mais ${echecs} photo(s) refusée(s) : ajoutez-les depuis sa fiche.`
          : null
      );
      setFichiers([]);
    },
    [fichiers]
  );

  const reinitialiser = useCallback(() => setFichiers([]), []);

  return {
    fichiers,
    setFichiers,
    manquantes,
    envoyer,
    avertissement,
    reinitialiser,
  };
}
