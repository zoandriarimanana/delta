/** Règles d'affichage du tableau de bord, en fonctions pures. */

import type { VenteProduit } from './tableauDeBord.types';

export type Classement = 'quantite' | 'chiffre';

/** Les `limite` premiers produits selon le classement choisi. */
export function classer(
  produits: VenteProduit[],
  classement: Classement,
  limite = 10
): VenteProduit[] {
  const valeur = (p: VenteProduit) =>
    classement === 'quantite' ? p.unites_vendues : Number(p.chiffre_affaires);
  return [...produits]
    .sort((a, b) => valeur(b) - valeur(a) || a.nom.localeCompare(b.nom))
    .slice(0, limite);
}

/** Part d'un produit par rapport au premier du classement, en pourcentage. */
export function part(
  produit: VenteProduit,
  premier: VenteProduit | undefined,
  classement: Classement
): number {
  if (premier === undefined) return 0;
  const valeur = (p: VenteProduit) =>
    classement === 'quantite' ? p.unites_vendues : Number(p.chiffre_affaires);
  const max = valeur(premier);
  return max > 0 ? Math.round((valeur(produit) / max) * 100) : 0;
}
