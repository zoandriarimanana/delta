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
 * `info` pour ce qui est acquis mais pas encore accompli (confirmé, à venir),
 * `neutre` quand aucune de ces lectures ne s'applique.
 *
 * Nommer l'intention plutôt que la couleur permet de changer la palette sans
 * relire chaque appelant — et empêche un module d'écrire « vert » là où il
 * voulait dire « disponible ».
 */
export type VarianteBadge = 'positif' | 'info' | 'attente' | 'negatif' | 'neutre';

const CLASSES: Record<VarianteBadge, string> = {
  positif: 'bg-succes/15 text-succes',
  info: 'bg-primaire/10 text-primaire',
  attente: 'bg-attente/15 text-attente',
  negatif: 'bg-danger/10 text-danger',
  neutre: 'bg-gris-200 text-gris-600',
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
