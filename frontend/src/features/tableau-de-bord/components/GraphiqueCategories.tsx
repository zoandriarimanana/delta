/**
 * Anneau de répartition du chiffre d'affaires par catégorie (14 octobre
 * 2026), avec sa légende — la couleur n'est jamais seule porteuse du sens.
 */

import { formaterMontant } from '@/features/commande/commande.service';

import type { VentesCategorie } from '../tableauDeBord.types';

/** Teintes de l'anneau, dans l'ordre des catégories (les plus vendues d'abord). */
const TEINTES = [
  'stroke-primaire',
  'stroke-action',
  'stroke-succes',
  'stroke-attente',
  'stroke-danger',
  'stroke-gris-400',
];
const PASTILLES = [
  'bg-primaire',
  'bg-action',
  'bg-succes',
  'bg-attente',
  'bg-danger',
  'bg-gris-400',
];

const RAYON = 60;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

export default function GraphiqueCategories({
  categories,
}: {
  categories: VentesCategorie[];
}) {
  const total = categories.reduce((s, c) => s + Number(c.chiffre_affaires), 0);
  if (total <= 0) {
    return <p className="py-10 text-center text-gris-500">Aucune vente à répartir.</p>;
  }

  let decalage = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label="Répartition du chiffre d’affaires par catégorie"
        className="h-44 w-44 -rotate-90"
      >
        <circle
          cx={80}
          cy={80}
          r={RAYON}
          className="fill-none stroke-gris-100"
          strokeWidth={22}
        />
        {categories.map((c, i) => {
          const longueur = (Number(c.chiffre_affaires) / total) * CIRCONFERENCE;
          const arc = (
            <circle
              key={c.categorie}
              cx={80}
              cy={80}
              r={RAYON}
              strokeWidth={22}
              strokeDasharray={`${longueur} ${CIRCONFERENCE - longueur}`}
              strokeDashoffset={-decalage}
              className={`fill-none ${TEINTES[i % TEINTES.length]}`}
            />
          );
          decalage += longueur;
          return arc;
        })}
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {categories.map((c, i) => (
          <li key={c.categorie} className="flex items-start gap-2">
            <span
              aria-hidden
              className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${PASTILLES[i % PASTILLES.length]}`}
            />
            <span className="min-w-0 flex-1 text-gris-700">{c.categorie}</span>
            <span className="whitespace-nowrap text-gris-600">
              {Math.round((Number(c.chiffre_affaires) / total) * 100)} % ·{' '}
              {formaterMontant(c.chiffre_affaires)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
