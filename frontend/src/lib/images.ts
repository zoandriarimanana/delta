/**
 * Illustrations d'ambiance du catalogue.
 *
 * Ces images sont **décoratives** : aucune donnée métier n'en dépend, et une
 * page reste utilisable si elles ne chargent pas.
 *
 * **La variété vient de l'identifiant, jamais du nom.** Une version antérieure
 * associait des URL à des noms littéraux — `'Éclair au chocolat'`,
 * `'Mille-feuille'` — repris du script de seed. Le procédé ne pouvait
 * correspondre que sur ces données-là : sur un catalogue réel, aucun nom ne
 * matche. Il donnait donc l'illusion d'une image par produit tout en n'ayant
 * aucun effet en production — et surtout, renommer un produit depuis le CRUD
 * lui faisait perdre son image **sans aucun signal**.
 *
 * L'identifiant, lui, ne change jamais. Il survit au renommage, fonctionne sur
 * des données réelles autant que sur le seed, et donne un choix **déterministe**
 * : le même produit garde la même image d'un chargement à l'autre.
 *
 * Le CDN externe est un point ouvert, hors du périmètre de ce module : il
 * implique une dépendance réseau à l'exécution et des requêtes vers un tiers
 * depuis le navigateur du visiteur.
 */

/** Familles d'illustrations, choisies par type d'entité ou par mot-clé. */
export type FamilleImage =
  'formation' | 'patisserie' | 'boulangerie' | 'salle' | 'logement';

const PALETTES: Record<FamilleImage, readonly string[]> = {
  formation: [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80',
    'https://images.unsplash.com/photo-1444565541849-ab7f84eaf40f?w=400&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
  ],
  patisserie: [
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80',
    'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&q=80',
    'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&q=80',
  ],
  boulangerie: [
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80',
    'https://images.unsplash.com/photo-1444565541849-ab7f84eaf40f?w=400&q=80',
  ],
  salle: ['https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80'],
  logement: ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&q=80'],
};

/**
 * Retourne une image de la famille, choisie par l'identifiant.
 *
 * Le modulo rend le choix **stable et réparti** : deux produits voisins
 * reçoivent des images différentes, et chacun garde la sienne indéfiniment.
 *
 * Une palette vide est impossible — elles sont écrites ici — mais
 * `noUncheckedIndexedAccess` exige de traiter le cas ; la première image de la
 * pâtisserie sert alors de repli plutôt qu'une chaîne vide, qui donnerait une
 * image cassée.
 */
export function imagePour(famille: FamilleImage, identifiant: number): string {
  const palette = PALETTES[famille];
  return palette[Math.abs(identifiant) % palette.length] ?? PALETTES.patisserie[0]!;
}

/**
 * Devine la famille d'un produit à partir de son nom.
 *
 * Heuristique **assumée** : elle ne sert qu'à choisir une ambiance, et se
 * trompe sans conséquence. Contrairement à une table de noms exacts, elle
 * continue de fonctionner sur des libellés qu'elle n'a jamais vus.
 */
export function familleProduit(nom: string): FamilleImage {
  const minuscules = nom.toLowerCase();
  return minuscules.includes('pain') ||
    minuscules.includes('boulang') ||
    minuscules.includes('baguette')
    ? 'boulangerie'
    : 'patisserie';
}

/** Image d'un produit du catalogue. */
export function imageProduit(idProduit: number, nom: string): string {
  return imagePour(familleProduit(nom), idProduit);
}

/** Image d'une formation. */
export function imageFormation(idFormation: number): string {
  return imagePour('formation', idFormation);
}
