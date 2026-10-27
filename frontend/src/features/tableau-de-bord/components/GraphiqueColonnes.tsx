/**
 * Graphique en colonnes du tableau de bord (14 octobre 2026) — produits les
 * plus vendus, formations les plus demandées. Chaque colonne porte sa valeur ;
 * la photo et le nom sont dessous, et mènent à la fiche. Le premier est mis
 * en avant (orange).
 */

import { Link } from 'react-router';

export interface Colonne {
  cle: string;
  nom: string;
  /** Valeur mesurée : décide de la hauteur. */
  valeur: number;
  /** Valeur telle qu'affichée au-dessus de la colonne. */
  libelle: string;
  image: string;
  lien: string;
  /** Détail complet, en infobulle. */
  detail: string;
}

interface Proprietes {
  colonnes: Colonne[];
  titre: string;
  vide: string;
}

export default function GraphiqueColonnes({ colonnes, titre, vide }: Proprietes) {
  if (colonnes.length === 0) {
    return <p className="py-10 text-center text-gris-500">{vide}</p>;
  }
  const max = Math.max(...colonnes.map((c) => c.valeur), 1);

  return (
    <ol
      aria-label={titre}
      className="flex h-72 items-end gap-2 overflow-x-auto pb-1 sm:gap-3"
    >
      {colonnes.map((colonne, rang) => (
        <li
          key={colonne.cle}
          className="flex h-full min-w-16 flex-1 flex-col items-center justify-end"
          title={colonne.detail}
        >
          <span className="mb-1 whitespace-nowrap text-xs font-semibold text-gris-700">
            {colonne.libelle}
          </span>
          <div
            className={`w-full max-w-14 rounded-t-lg ${
              rang === 0 ? 'bg-action' : 'bg-primaire'
            }`}
            style={{
              height: `${Math.max(Math.round((colonne.valeur / max) * 100), 3)}%`,
            }}
          />
          <img
            src={colonne.image}
            alt=""
            className="mt-2 h-9 w-9 shrink-0 rounded-lg object-cover"
          />
          <Link
            to={colonne.lien}
            className="mt-1 line-clamp-2 h-8 w-full text-center text-[11px] leading-4 text-gris-600 no-underline hover:text-primaire"
          >
            {colonne.nom}
          </Link>
        </li>
      ))}
    </ol>
  );
}
