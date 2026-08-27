/**
 * Catalogue public des formations, filtrable par domaine.
 *
 * Aucune authentification : un visiteur doit pouvoir parcourir l'offre sans
 * compte, exactement comme le catalogue produit.
 */

import { useState } from 'react';

import CarteFormation from '../components/CarteFormation';
import { useDomaines, useFormations } from '../formation.hooks';

export default function FormationListPage() {
  const [idDomaine, setIdDomaine] = useState<number | null>(null);
  const domaines = useDomaines();
  const formations = useFormations(idDomaine);

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-terracotta mb-2">Nos formations</h1>
        <p className="text-warm-gray-600">Découvrez nos ateliers et sessions de formation culinaire</p>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <label htmlFor="filtre-domaine" className="font-medium text-warm-gray-700">
          Filtrer par domaine:
        </label>
        <select
          id="filtre-domaine"
          value={idDomaine ?? ''}
          onChange={(evenement) =>
            setIdDomaine(
              evenement.target.value === '' ? null : Number(evenement.target.value)
            )
          }
          className="rounded-lg border-2 border-warm-gray-200 px-3 py-2 bg-white text-warm-gray-700 hover:border-terracotta transition-colors"
        >
          <option value="">Tous les domaines</option>
          {(domaines.donnees ?? []).map((domaine) => (
            <option key={domaine.id_domaine} value={domaine.id_domaine}>
              {domaine.libelle}
            </option>
          ))}
        </select>
      </div>

      {formations.chargement && (
        <p role="status" className="text-center py-8 text-warm-gray-500">
          ⏳ Chargement des formations…
        </p>
      )}

      {formations.erreur !== null && (
        <div
          role="alert"
          className="rounded-lg bg-terracotta/10 border-2 border-terracotta p-4 text-terracotta"
        >
          ⚠️ {formations.erreur}
        </div>
      )}

      {formations.donnees !== null && formations.donnees.length === 0 && (
        <div className="text-center py-12">
          <p className="text-warm-gray-600 mb-4">Aucune formation ne correspond à votre recherche.</p>
          <button
            onClick={() => setIdDomaine(null)}
            className="text-terracotta hover:text-burgundy font-medium transition-colors underline"
          >
            Voir toutes les formations
          </button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(formations.donnees ?? []).map((formation) => (
          <div key={formation.id_formation}>
            <CarteFormation formation={formation} />
          </div>
        ))}
      </div>
    </section>
  );
}
