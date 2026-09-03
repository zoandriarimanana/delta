/**
 * Types du module produit, calqués sur le contrat réel de l'API.
 *
 * Relevés depuis le schéma OpenAPI, pas depuis les modèles Python : c'est ce que
 * le client reçoit qui compte.
 */

export interface Produit {
  id_produit: number;
  nom: string;
  description: string | null;
  /**
   * **Chaîne, pas nombre.** `prix_unitaire` est un `Decimal` côté serveur, que
   * FastAPI sérialise en chaîne pour ne pas perdre de précision au passage par
   * le flottant JSON. Le convertir en `number` est du ressort de l'affichage,
   * pas du transport.
   */
  prix_unitaire: string;
  unite_mesure: string;
  stock_disponible: number;
  est_personnalisable: boolean;
  /**
   * Tarif de la personnalisation, **par unité**. `null` pour un produit non
   * personnalisable — un `CHECK` en base interdit qu'un produit
   * personnalisable en soit dépourvu (cf. `docs/mld.md`).
   */
  supplement_personnalisation: string | null;
  est_livrable: boolean;
  id_categorie: number;
}

export interface CategorieProduit {
  id_categorie: number;
  libelle: string;
}

/**
 * Produit en sortie des **listes d'administration**, archives comprises.
 *
 * Type distinct de `Produit`, miroir des deux schemas de sortie du serveur :
 * `supprime_le` n'est exposé que sur les routes protégées, et le déclarer sur
 * le type public inviterait à l'attendre là où il n'arrive jamais.
 */
export interface ProduitAdministration extends Produit {
  /** `null` si actif, horodatage de l'archivage sinon. */
  supprime_le: string | null;
}

/** Catégorie en sortie des listes d'administration. */
export interface CategorieProduitAdministration extends CategorieProduit {
  supprime_le: string | null;
}

/**
 * Charge utile de création d'un produit.
 *
 * Ni `id_produit` ni `supprime_le` : le premier est attribué par la base, le
 * second est un cycle de vie que seuls l'archivage et la restauration écrivent.
 */
export interface ProduitEnvoye {
  nom: string;
  description?: string | null;
  prix_unitaire: string;
  unite_mesure: string;
  stock_disponible: number;
  est_personnalisable: boolean;
  supplement_personnalisation?: string | null;
  est_livrable: boolean;
  id_categorie: number;
}

/**
 * Charge utile de modification — **partielle**.
 *
 * Le serveur n'écrit que les clés présentes : envoyer un objet complet
 * écraserait des colonnes que l'utilisateur n'a pas touchées.
 */
export type ProduitModifie = Partial<ProduitEnvoye>;

/** Charge utile d'une catégorie : un libellé, unique parmi les actives. */
export interface CategorieEnvoyee {
  libelle: string;
}
