/**
 * Types du module galerie, relevés du schéma OpenAPI.
 *
 * Les photos du catalogue n'ont **pas de table** : elles sont rangées sur
 * disque, dans `static/upload/<partie>/`, et une photo se désigne par son nom
 * de fichier `<id>-<n>.<ext>` — `3-2.jpg` est la deuxième photo de l'élément
 * n°3. Les octets se lisent à part, à l'URL que donne `urlPhoto`.
 */

export interface PhotoBien {
  fichier: string;
}

/**
 * L'élément dont on affiche ou gère les photos : une salle, un logement, une
 * formation, un produit **ou** une catégorie (ses exemples de réalisations,
 * 14 octobre 2026) — jamais deux à la fois, ce que l'union rend inexprimable.
 */
export type BienPhotographie =
  | { salle: number }
  | { logement: number }
  | { formation: number }
  | { produit: number }
  | { categorie: number };

/** Parties dont une liste affiche les couvertures. */
export type PartieCatalogue = 'salles' | 'logements' | 'formations' | 'produits';
