/**
 * Appels HTTP du module galerie — et rien d'autre.
 *
 * Lectures **publiques** (un visiteur voit les lieux et les produits avant de
 * réserver ou de commander), écritures réservées aux administrateurs : le
 * frontend ne vérifie aucun droit, c'est le serveur qui refuse en 403.
 */

import { axiosClient } from '@/lib/axiosClient';

import type { BienPhotographie, PhotoBien } from './galerie.types';

/** Dossier de la partie sur le serveur : `static/upload/<partie>/`. */
export function partieDe(bien: BienPhotographie): string {
  if ('salle' in bien) return 'salles';
  if ('logement' in bien) return 'logements';
  if ('formation' in bien) return 'formations';
  return 'produits';
}

function identifiantDe(bien: BienPhotographie): number {
  if ('salle' in bien) return bien.salle;
  if ('logement' in bien) return bien.logement;
  if ('formation' in bien) return bien.formation;
  return bien.produit;
}

function cheminGalerie(bien: BienPhotographie): string {
  return `/${partieDe(bien)}/${identifiantDe(bien)}/photos`;
}

/** Photos d'un élément, dans l'ordre des numéros — la première sert de couverture. */
export async function recupererPhotos(bien: BienPhotographie): Promise<PhotoBien[]> {
  const reponse = await axiosClient.get<PhotoBien[]>(cheminGalerie(bien));
  return reponse.data;
}

/** URL de l'image elle-même, à poser dans un `<img src>`. */
export function urlPhoto(bien: BienPhotographie, fichier: string): string {
  return `${axiosClient.defaults.baseURL}/photos/${partieDe(bien)}/${fichier}`;
}

/** Envoie une image ; le serveur la range sous `<id>-<n>.<ext>`. */
export async function ajouterPhoto(
  bien: BienPhotographie,
  fichier: File
): Promise<PhotoBien> {
  const corps = new FormData();
  corps.append('fichier', fichier);
  // `Content-Type` retiré : sinon le `application/json` par défaut d'axios
  // écraserait la frontière multipart que le navigateur doit générer — même
  // précaution que `televerserPhotoPersonnel`.
  const reponse = await axiosClient.post<PhotoBien>(cheminGalerie(bien), corps, {
    headers: { 'Content-Type': undefined },
  });
  return reponse.data;
}

/** Supprime le fichier du disque. */
export async function supprimerPhoto(
  bien: BienPhotographie,
  fichier: string
): Promise<void> {
  await axiosClient.delete(`/photos/${partieDe(bien)}/${fichier}`);
}
