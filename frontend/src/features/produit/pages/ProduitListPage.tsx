/**
 * Catalogue public : liste des produits, filtrable par catégorie.
 *
 * Consultable sans être connecté — aucun appel protégé n'est déclenché ici.
 */

import { useState } from 'react';

import ProduitCarte from '../components/ProduitCarte';
import { useCategories, useProduits } from '../produit.hooks';
import { TOUTES_CATEGORIES, type FiltreCategorie } from '../produit.service';

export default function ProduitListPage() {
  const [filtre, setFiltre] = useState<FiltreCategorie>(TOUTES_CATEGORIES);
  const produits = useProduits(filtre);
  const categories = useCategories();

  return (
    <section>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-terracotta mb-2">
            Catalogue
          </h1>
          <p className="text-warm-gray-600">
            Pâtisserie, boulangerie, confiture et spécialités
          </p>
        </div>
        {categories.donnees !== null && (
          <div className="flex items-center gap-3">
            <label
              htmlFor="filtre-categorie"
              className="font-medium text-warm-gray-700"
            >
              Catégorie
            </label>
            <select
              id="filtre-categorie"
              value={filtre === TOUTES_CATEGORIES ? '' : filtre}
              onChange={(e) =>
                setFiltre(
                  e.target.value === ''
                    ? TOUTES_CATEGORIES
                    : (Number(e.target.value) as FiltreCategorie)
                )
              }
              className="rounded-lg border-2 border-warm-gray-200 px-3 py-2 bg-white text-warm-gray-700 hover:border-terracotta transition-colors"
            >
              <option value="">Tous</option>
              {categories.donnees.map((cat) => (
                <option key={cat.id_categorie} value={cat.id_categorie}>
                  {cat.libelle}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {produits.chargement && (
        <p role="status" className="text-center py-8 text-warm-gray-500">
          ⏳ Chargement des produits…
        </p>
      )}

      {produits.erreur !== null && (
        <div
          role="alert"
          className="rounded-lg bg-terracotta/10 border-2 border-terracotta p-4 text-terracotta"
        >
          ⚠️ {produits.erreur}
        </div>
      )}

      {produits.donnees !== null && produits.donnees.length === 0 && (
        <div className="text-center py-12">
          <p className="text-warm-gray-600 mb-4">Aucun produit dans cette catégorie.</p>
          <button
            onClick={() => setFiltre(TOUTES_CATEGORIES)}
            className="text-terracotta hover:text-burgundy font-medium transition-colors underline"
          >
            Voir tous les produits
          </button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-8">
        {produits.donnees?.map((produit) => (
          <ProduitCarte key={produit.id_produit} produit={produit} />
        ))}
      </div>
    </section>
  );
}
