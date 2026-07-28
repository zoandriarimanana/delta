/** Sélecteur de catégorie du catalogue. */

import {
  TOUTES_CATEGORIES,
  depuisValeurSelect,
  type FiltreCategorie,
} from '../produit.service';
import type { CategorieProduit } from '../produit.types';

interface Proprietes {
  categories: CategorieProduit[];
  valeur: FiltreCategorie;
  onChangement: (filtre: FiltreCategorie) => void;
}

export default function FiltreCategories({
  categories,
  valeur,
  onChangement,
}: Proprietes) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="filtre-categorie" className="text-sm text-slate-700">
        Catégorie
      </label>
      <select
        id="filtre-categorie"
        value={String(valeur)}
        onChange={(evenement) =>
          onChangement(depuisValeurSelect(evenement.target.value))
        }
        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value={TOUTES_CATEGORIES}>Toutes</option>
        {categories.map((categorie) => (
          <option key={categorie.id_categorie} value={categorie.id_categorie}>
            {categorie.libelle}
          </option>
        ))}
      </select>
    </div>
  );
}
