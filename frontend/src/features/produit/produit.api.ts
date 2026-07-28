/**
 * Appels HTTP du module produit — et rien d'autre.
 *
 * Aucune mise en forme, aucune règle métier : ce fichier traduit une intention
 * en requête et rend la réponse telle quelle. L'instance axios est celle de
 * `lib/axiosClient`, jamais une nouvelle (cf. `docs/architecture.md`).
 */

import { axiosClient } from '@/lib/axiosClient';

import type { CategorieProduit, Produit } from './produit.types';

const CHEMIN_PRODUITS = '/produits';
const CHEMIN_CATEGORIES = '/categories-produit';

/**
 * Liste les produits du catalogue, éventuellement filtrés par catégorie.
 *
 * Le paramètre est omis quand aucune catégorie n'est demandée : envoyer
 * `id_categorie=` vide ferait échouer la validation côté serveur.
 */
export async function recupererProduits(idCategorie?: number): Promise<Produit[]> {
  const reponse = await axiosClient.get<Produit[]>(CHEMIN_PRODUITS, {
    params: idCategorie === undefined ? undefined : { id_categorie: idCategorie },
  });
  return reponse.data;
}

/** Récupère un produit par son identifiant. L'API répond 404 s'il n'existe pas. */
export async function recupererProduit(idProduit: number): Promise<Produit> {
  const reponse = await axiosClient.get<Produit>(`${CHEMIN_PRODUITS}/${idProduit}`);
  return reponse.data;
}

/** Liste les catégories, pour alimenter le filtre du catalogue. */
export async function recupererCategories(): Promise<CategorieProduit[]> {
  const reponse = await axiosClient.get<CategorieProduit[]>(CHEMIN_CATEGORIES);
  return reponse.data;
}
