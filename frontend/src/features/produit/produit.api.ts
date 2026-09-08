/**
 * Appels HTTP du module produit — et rien d'autre.
 *
 * Aucune mise en forme, aucune règle métier : ce fichier traduit une intention
 * en requête et rend la réponse telle quelle. L'instance axios est celle de
 * `lib/axiosClient`, jamais une nouvelle (cf. `docs/architecture.md`).
 */

import { axiosClient } from '@/lib/axiosClient';

import type {
  CategorieEnvoyee,
  CategorieProduit,
  CategorieProduitAdministration,
  Produit,
  ProduitAdministration,
  ProduitEnvoye,
  ProduitModifie,
} from './produit.types';

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

// --- Administration ---------------------------------------------------------
//
// Ces appels visent des routes **protégées** par `get_current_personnel_administrateur`.
// Le frontend ne vérifie aucun droit : `est_administrateur` n'est lisible nulle
// part côté client, et c'est le serveur qui refuse en 403.

/**
 * Catalogue complet pour l'administration : produits **actifs et archivés**.
 *
 * Route distincte de la liste publique, et non un paramètre : celle-ci est
 * ouverte à tous, et ne remonte jamais d'archive.
 */
export async function recupererProduitsAdministration(): Promise<
  ProduitAdministration[]
> {
  const reponse = await axiosClient.get<ProduitAdministration[]>(
    `${CHEMIN_PRODUITS}/administration`
  );
  return reponse.data;
}

/** Catégories pour l'administration, archivées comprises. */
export async function recupererCategoriesAdministration(): Promise<
  CategorieProduitAdministration[]
> {
  const reponse = await axiosClient.get<CategorieProduitAdministration[]>(
    `${CHEMIN_CATEGORIES}/administration`
  );
  return reponse.data;
}

export async function creerProduit(donnees: ProduitEnvoye): Promise<Produit> {
  const reponse = await axiosClient.post<Produit>(CHEMIN_PRODUITS, donnees);
  return reponse.data;
}

export async function modifierProduit(
  idProduit: number,
  donnees: ProduitModifie
): Promise<Produit> {
  const reponse = await axiosClient.put<Produit>(
    `${CHEMIN_PRODUITS}/${idProduit}`,
    donnees
  );
  return reponse.data;
}

/**
 * **Archive** un produit — aucun `DELETE` SQL n'est émis.
 *
 * Le nom de la fonction le dit, parce que l'écran doit le dire aussi :
 * `supprimer_definitivement` n'est exposé par aucun endpoint, et promettre un
 * effacement qui n'a pas lieu serait un mensonge d'interface.
 */
export async function archiverProduit(idProduit: number): Promise<void> {
  await axiosClient.delete(`${CHEMIN_PRODUITS}/${idProduit}`);
}

/** Réactive un produit archivé. Ne peut pas échouer sur une collision. */
export async function restaurerProduit(idProduit: number): Promise<Produit> {
  const reponse = await axiosClient.post<Produit>(
    `${CHEMIN_PRODUITS}/${idProduit}/restauration`
  );
  return reponse.data;
}

export async function creerCategorie(
  donnees: CategorieEnvoyee
): Promise<CategorieProduit> {
  const reponse = await axiosClient.post<CategorieProduit>(CHEMIN_CATEGORIES, donnees);
  return reponse.data;
}

export async function modifierCategorie(
  idCategorie: number,
  donnees: CategorieEnvoyee
): Promise<CategorieProduit> {
  const reponse = await axiosClient.put<CategorieProduit>(
    `${CHEMIN_CATEGORIES}/${idCategorie}`,
    donnees
  );
  return reponse.data;
}

/** **Archive** une catégorie. 409 si elle contient encore des produits actifs. */
export async function archiverCategorie(idCategorie: number): Promise<void> {
  await axiosClient.delete(`${CHEMIN_CATEGORIES}/${idCategorie}`);
}

/**
 * Réactive une catégorie archivée.
 *
 * **Peut échouer en 409**, contrairement à celle d'un produit : le libellé a pu
 * être repris pendant l'archivage, l'index unique étant partiel.
 */
export async function restaurerCategorie(
  idCategorie: number
): Promise<CategorieProduit> {
  const reponse = await axiosClient.post<CategorieProduit>(
    `${CHEMIN_CATEGORIES}/${idCategorie}/restauration`
  );
  return reponse.data;
}
