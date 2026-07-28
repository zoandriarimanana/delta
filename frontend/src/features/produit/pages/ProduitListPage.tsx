/**
 * Catalogue public : liste des produits, filtrable par catégorie.
 *
 * Consultable sans être connecté — aucun appel protégé n'est déclenché ici.
 */

import { useState } from 'react';

import EtatRequete from '../components/EtatRequete';
import FiltreCategories from '../components/FiltreCategories';
import ProduitCarte from '../components/ProduitCarte';
import { useCategories, useProduits } from '../produit.hooks';
import { TOUTES_CATEGORIES, type FiltreCategorie } from '../produit.service';

export default function ProduitListPage() {
  const [filtre, setFiltre] = useState<FiltreCategorie>(TOUTES_CATEGORIES);
  const produits = useProduits(filtre);
  const categories = useCategories();

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Catalogue</h1>
        {/* Le filtre n'apparaît qu'une fois les catégories chargées : proposer
            une liste vide laisserait croire qu'il n'y en a aucune. */}
        {categories.donnees !== null && (
          <FiltreCategories
            categories={categories.donnees}
            valeur={filtre}
            onChangement={setFiltre}
          />
        )}
      </div>

      {/* L'échec du chargement des catégories ne masque pas le catalogue : le
          filtre disparaît, les produits restent consultables. */}
      <div className="mt-6">
        <EtatRequete
          chargement={produits.chargement}
          erreur={produits.erreur}
          estVide={produits.donnees?.length === 0}
          messageVide="Aucun produit dans cette catégorie."
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {produits.donnees?.map((produit) => (
              <ProduitCarte key={produit.id_produit} produit={produit} />
            ))}
          </ul>
        </EtatRequete>
      </div>
    </section>
  );
}
