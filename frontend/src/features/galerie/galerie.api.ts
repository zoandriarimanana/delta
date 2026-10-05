/**
 * Appels HTTP du module galerie — et rien d'autre.
 *
 * Lectures **publiques** (un visiteur voit les lieux avant de réserver),
 * écritures réservées aux administrateurs : le frontend ne vérifie aucun droit,
 * c'est le serveur qui refuse en 403.
 */

import { axiosClient } from '@/lib/axiosClient';

import type { BienPhotographie, PhotoBien } from './galerie.types';

function cheminGalerie(bien: BienPhotographie): string {
  return 'salle' in bien
    ? `/salles/${bien.salle}/photos`
    : `/logements/${bien.logement}/photos`;
}

/** Galerie d'un bien, dans l'ordre d'ajout — la première sert de couverture. */
export async function recupererPhotos(bien: BienPhotographie): Promise<PhotoBien[]> {
  const reponse = await axiosClient.get<PhotoBien[]>(cheminGalerie(bien));
  return reponse.data;
}

/**
 * URL de l'image elle-même, à poser dans un `<img src>`.
 *
 * Servie avec un cache long : une photo ne se remplace jamais à URL
 * constante, elle se retire puis s'ajoute sous un nouvel identifiant.
 */
export function urlPhoto(idPhoto: number): string {
  return `${axiosClient.defaults.baseURL}/photos-biens/${idPhoto}`;
}

export async function ajouterPhoto(
  bien: BienPhotographie,
  fichier: File,
  legende: string
): Promise<PhotoBien> {
  const corps = new FormData();
  corps.append('fichier', fichier);
  if (legende.trim() !== '') {
    corps.append('legende', legende.trim());
  }
  // `Content-Type` retiré : sinon le `application/json` par défaut d'axios
  // écraserait la frontière multipart que le navigateur doit générer — même
  // précaution que `televerserPhotoPersonnel`.
  const reponse = await axiosClient.post<PhotoBien>(cheminGalerie(bien), corps, {
    headers: { 'Content-Type': undefined },
  });
  return reponse.data;
}

/** Retire **définitivement** une photo : une image n'a aucune valeur probante. */
export async function supprimerPhoto(idPhoto: number): Promise<void> {
  await axiosClient.delete(`/photos-biens/${idPhoto}`);
}
