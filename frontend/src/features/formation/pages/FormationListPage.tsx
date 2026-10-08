/**
 * Catalogue public des formations, filtrable par domaine.
 *
 * Aucune authentification : un visiteur doit pouvoir parcourir l'offre sans
 * compte, exactement comme le catalogue produit.
 */

import { useState } from 'react';

import { useTextes } from '@/lib/langue';

import { TEXTES_FORMATION } from '../formation.textes';
import CarteFormation from '../components/CarteFormation';
import { useDomaines, useFormations } from '../formation.hooks';

export default function FormationListPage() {
  const t = useTextes(TEXTES_FORMATION);
  const [idDomaine, setIdDomaine] = useState<number | null>(null);
  const domaines = useDomaines();
  const formations = useFormations(idDomaine);

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-primaire mb-2">
          {t.nosFormations}
        </h1>
        <p className="text-gris-600">{t.sousTitre}</p>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <label htmlFor="filtre-domaine" className="font-medium text-gris-700">
          {t.filtrerDomaine}
        </label>
        <select
          id="filtre-domaine"
          value={idDomaine ?? ''}
          onChange={(evenement) =>
            setIdDomaine(
              evenement.target.value === '' ? null : Number(evenement.target.value)
            )
          }
          className="rounded-lg border-2 border-gris-200 px-3 py-2 bg-surface text-gris-700 hover:border-primaire transition-colors"
        >
          <option value="">{t.tousDomaines}</option>
          {(domaines.donnees ?? []).map((domaine) => (
            <option key={domaine.id_domaine} value={domaine.id_domaine}>
              {domaine.libelle}
            </option>
          ))}
        </select>
      </div>

      {formations.chargement && (
        <p role="status" className="text-center py-8 text-gris-500">
          {t.chargementFormations}
        </p>
      )}

      {formations.erreur !== null && (
        <div
          role="alert"
          className="rounded-lg bg-danger/10 border-2 border-danger p-4 text-danger"
        >
          ⚠️ {formations.erreur}
        </div>
      )}

      {formations.donnees !== null && formations.donnees.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gris-600 mb-4">{t.aucuneFormation}</p>
          <button
            onClick={() => setIdDomaine(null)}
            className="text-primaire hover:text-primaire-fonce font-medium transition-colors underline"
          >
            {t.voirToutes}
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
