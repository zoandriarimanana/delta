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
      <h1 className="text-2xl font-semibold text-slate-900">Nos formations</h1>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        Domaine
        <select
          value={idDomaine ?? ''}
          onChange={(evenement) =>
            setIdDomaine(
              evenement.target.value === '' ? null : Number(evenement.target.value)
            )
          }
          className="rounded border border-slate-300 px-2 py-1"
        >
          {/* La valeur vide signifie « tous les domaines », pas « aucun ». */}
          <option value="">Tous</option>
          {(domaines.donnees ?? []).map((domaine) => (
            <option key={domaine.id_domaine} value={domaine.id_domaine}>
              {domaine.libelle}
            </option>
          ))}
        </select>
      </label>

      {formations.chargement && (
        <p role="status" className="mt-4 text-slate-500">
          Chargement…
        </p>
      )}

      {formations.erreur !== null && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {formations.erreur}
        </p>
      )}

      {formations.donnees !== null && formations.donnees.length === 0 && (
        <p className="mt-4 text-slate-600">
          Aucune formation ne correspond à ce filtre.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {(formations.donnees ?? []).map((formation) => (
          <CarteFormation key={formation.id_formation} formation={formation} />
        ))}
      </ul>
    </section>
  );
}
