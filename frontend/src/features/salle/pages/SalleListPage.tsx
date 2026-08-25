/**
 * Catalogue public des salles.
 *
 * Lecture ouverte : un visiteur doit pouvoir comparer les espaces avant de se
 * créer un compte. La réservation, elle, exige un jeton.
 */

import { useState } from 'react';
import { Link } from 'react-router';

import { useSalles } from '../salle.hooks';
import { libelleTarif } from '../salle.service';

export default function SalleListPage() {
  // `null` signifie « toutes les capacités ». Une saisie illisible retombe
  // dessus plutôt que d'émettre une requête avec `NaN`.
  const [capacite, setCapacite] = useState<number | null>(null);
  const { donnees, chargement, erreur } = useSalles(capacite);

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Nos salles</h1>
      <p className="mt-2 text-slate-600">
        Espaces de réunion, de formation et de réception.
      </p>

      <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
        Capacité minimale
        <input
          type="number"
          min={1}
          value={capacite ?? ''}
          onChange={(evenement) => {
            const saisie = Number(evenement.target.value);
            setCapacite(Number.isInteger(saisie) && saisie > 0 ? saisie : null);
          }}
          className="w-24 rounded border border-slate-300 px-2 py-1"
        />
      </label>

      {chargement && (
        <p role="status" className="mt-6 text-slate-500">
          Chargement…
        </p>
      )}

      {erreur !== null && (
        <p role="alert" className="mt-6 text-red-800">
          {erreur}
        </p>
      )}

      {donnees !== null && donnees.length === 0 && (
        <p className="mt-6 text-slate-600">
          Aucune salle ne correspond à cette capacité.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {(donnees ?? []).map((salle) => (
          <li
            key={salle.id_salle}
            className="rounded border border-slate-200 bg-white p-4"
          >
            <h2 className="font-medium text-slate-900">
              <Link to={`/salles/${salle.id_salle}`} className="underline">
                {salle.nom}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {salle.capacite} personne(s) — {libelleTarif(salle)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
