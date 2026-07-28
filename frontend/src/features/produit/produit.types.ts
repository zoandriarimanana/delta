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
  est_livrable: boolean;
  id_categorie: number;
}

export interface CategorieProduit {
  id_categorie: number;
  libelle: string;
}
