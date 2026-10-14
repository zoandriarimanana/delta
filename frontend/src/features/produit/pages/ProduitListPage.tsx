/**
 * Catalogue public : liste des produits, filtrable par catégorie.
 *
 * Consultable sans être connecté — aucun appel protégé n'est déclenché ici.
 */

import { useState } from 'react';

import { useTextes } from '@/lib/langue';

import { TEXTES_PRODUIT } from '../produit.textes';
import { useImageCouverture } from '@/features/galerie/galerie.hooks';
import { imageProduit } from '@/lib/images';
import ExemplesRealisations from '@/features/galerie/components/ExemplesRealisations';
import ProduitCarte from '../components/ProduitCarte';
import { useCategories, useProduits } from '../produit.hooks';
import { TOUTES_CATEGORIES, type FiltreCategorie } from '../produit.service';

export default function ProduitListPage() {
  const image = useImageCouverture('produits');
  const t = useTextes(TEXTES_PRODUIT);
  const [filtre, setFiltre] = useState<FiltreCategorie>(TOUTES_CATEGORIES);
  const produits = useProduits(filtre);
  const categories = useCategories();

  return (
    <section>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-primaire mb-2">
            {t.catalogue}
          </h1>
          <p className="text-gris-600">{t.catalogueSousTitre}</p>
        </div>
        {categories.donnees !== null && (
          <div className="flex items-center gap-3">
            <label htmlFor="filtre-categorie" className="font-medium text-gris-700">
              {t.categorie}
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
              className="rounded-lg border-2 border-gris-200 px-3 py-2 bg-surface text-gris-700 hover:border-primaire transition-colors"
            >
              <option value="">{t.tous}</option>
              {categories.donnees.map((cat) => (
                <option key={cat.id_categorie} value={cat.id_categorie}>
                  {cat.libelle}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {filtre !== TOUTES_CATEGORIES && categories.donnees !== null && (
        <ExemplesRealisations
          key={filtre}
          idCategorie={filtre}
          titre={t.exemplesRealisations(
            categories.donnees.find((c) => c.id_categorie === filtre)?.libelle ?? ''
          )}
        />
      )}

      {produits.chargement && (
        <p role="status" className="text-center py-8 text-gris-500">
          {t.chargementProduits}
        </p>
      )}

      {produits.erreur !== null && (
        <div
          role="alert"
          className="rounded-lg bg-danger/10 border-2 border-danger p-4 text-danger"
        >
          ⚠️ {produits.erreur}
        </div>
      )}

      {produits.donnees !== null && produits.donnees.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gris-600 mb-4">{t.aucunProduit}</p>
          <button
            onClick={() => setFiltre(TOUTES_CATEGORIES)}
            className="text-primaire hover:text-primaire-fonce font-medium transition-colors underline"
          >
            {t.voirTous}
          </button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-8">
        {produits.donnees?.map((produit) => (
          <ProduitCarte
            key={produit.id_produit}
            produit={produit}
            image={image(
              produit.id_produit,
              imageProduit(produit.id_produit, produit.nom)
            )}
          />
        ))}
      </div>
    </section>
  );
}
