/**
 * Appels HTTP du module galerie — et rien d'autre.
 *
 * Lectures **publiques** (un visiteur voit les lieux et les produits avant de
 * réserver ou de commander), écritures réservées aux administrateurs : le
 * frontend ne vérifie aucun droit, c'est le serveur qui refuse en 403.
 */

import { axiosClient } from '@/lib/axiosClient';

import type { BienPhotographie, PartieCatalogue, PhotoBien } from './galerie.types';

/** Dossier de la partie sur le serveur : `static/upload/<partie>/`. */
export function partieDe(bien: BienPhotographie): string {
  if ('salle' in bien) return 'salles';
  if ('logement' in bien) return 'logements';
  if ('formation' in bien) return 'formations';
  if ('categorie' in bien) return 'categories';
  return 'produits';
}

export function identifiantDe(bien: BienPhotographie): number {
  if ('salle' in bien) return bien.salle;
  if ('logement' in bien) return bien.logement;
  if ('formation' in bien) return bien.formation;
  if ('categorie' in bien) return bien.categorie;
  return bien.produit;
}

function cheminGalerie(bien: BienPhotographie): string {
  // La route d'une catégorie porte le nom de son entité, pas de sa partie.
  const prefixe = 'categorie' in bien ? 'categories-produit' : partieDe(bien);
  return `/${prefixe}/${identifiantDe(bien)}/photos`;
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

/** URL de la copie de la photo choisie pour une ligne de commande (partie
 * `lignes`, 14 octobre 2026). */
export function urlPhotoLigne(fichier: string): string {
  return `${axiosClient.defaults.baseURL}/photos/lignes/${fichier}`;
}

/** URL de la copie du modèle choisi par un client (partie `modeles`). */
export function urlModele(fichier: string): string {
  return `${axiosClient.defaults.baseURL}/photos/modeles/${fichier}`;
}

/** URL d'une photo désignée par sa partie, pour les cartes des listes. */
export function urlPhotoPartie(partie: PartieCatalogue, fichier: string): string {
  return `${axiosClient.defaults.baseURL}/photos/${partie}/${fichier}`;
}

/** `{identifiant: fichier}` : première photo de chaque élément, en une requête. */
export async function recupererCouvertures(
  partie: PartieCatalogue
): Promise<Record<string, string>> {
  const reponse = await axiosClient.get<Record<string, string>>(
    `/photos/${partie}/couvertures`
  );
  return reponse.data;
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

/**
 * Envoie, l'une après l'autre, les photos choisies à la création d'un
 * élément (14 octobre 2026) ; dans l'ordre, pour que la première reste la
 * couverture. Retourne le nombre d'envois refusés — l'élément, lui, est
 * déjà créé : ses photos manquantes s'ajoutent ensuite depuis sa fiche.
 */
export async function televerserPhotos(
  bien: BienPhotographie,
  fichiers: File[]
): Promise<number> {
  let echecs = 0;
  for (const fichier of fichiers) {
    try {
      await ajouterPhoto(bien, fichier);
    } catch {
      echecs += 1;
    }
  }
  return echecs;
}

/** Où un client peut prendre son modèle : la galerie du produit, ou les
 * exemples de sa catégorie (14 octobre 2026). */
export type SourceModele = 'produits' | 'categories';

/** URL d'une photo proposée comme modèle, désignée par sa source et son fichier. */
export function urlExemple(
  fichier: string,
  source: SourceModele = 'categories'
): string {
  return `${axiosClient.defaults.baseURL}/photos/${source}/${fichier}`;
}
