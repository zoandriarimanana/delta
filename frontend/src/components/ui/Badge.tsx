/**
 * Pastille colorée — **primitive purement présentationnelle**.
 *
 * Elle ne connaît **aucune entité** du MLD, et c'est sa raison d'être. La
 * version d'origine portait une table de statuts couvrant `LOGEMENT`,
 * `RESERVATION`, `LIVRAISON` et la rupture produit à la fois, alors que
 * `logement.service.ts`, `reservation.service.ts` et `livraison.service.ts`
 * portent **déjà chacun** son `libelleStatut`. C'était une duplication croisant
 * quatre entités, là où la SRP impose un fichier par entité.
 *
 * Ici, le composant reçoit une **variante visuelle** et un libellé déjà
 * traduit. Chaque module traduit son propre statut et choisit sa variante : la
 * logique métier reste où elle est, la pastille ne fait que la peindre.
 */

import type { ReactNode } from 'react';

/**
 * Intention visuelle, exprimée en termes d'état et non de couleur.
 *
 * `positif` pour ce qui est acquis ou disponible, `attente` pour ce qui est en
 * cours ou suspendu, `negatif` pour ce qui est clos, annulé ou indisponible,
 * `neutre` quand aucune de ces lectures ne s'applique.
 *
 * Nommer l'intention plutôt que la couleur permet de changer la palette sans
 * relire chaque appelant — et empêche un module d'écrire « vert » là où il
 * voulait dire « disponible ».
 */
export type VarianteBadge = 'positif' | 'attente' | 'negatif' | 'neutre';

const CLASSES: Record<VarianteBadge, string> = {
  positif: 'bg-sage/15 text-sage',
  attente: 'bg-amber/15 text-amber',
  negatif: 'bg-terracotta/15 text-terracotta',
  neutre: 'bg-warm-gray-200 text-warm-gray-600',
};

interface Proprietes {
  variante?: VarianteBadge;
  children: ReactNode;
}

export default function Badge({ variante = 'neutre', children }: Proprietes) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${CLASSES[variante]}`}
    >
      {children}
    </span>
  );
}
