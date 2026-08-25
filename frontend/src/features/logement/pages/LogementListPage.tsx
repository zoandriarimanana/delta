/**
 * Catalogue public des logements.
 *
 * Seuls les logements `Disponible` sont listés par défaut : un bien en
 * maintenance ou retiré de l'offre n'a rien à faire dans un catalogue de
 * réservation. Le filtre porte sur **l'état du bien**, jamais sur son
 * occupation — il n'existe pas de statut « Occupé » (cf. `docs/mld.md`).
 */

import { useState } from 'react';
import { Link } from 'react-router';

import { formaterMontant } from '@/features/commande/commande.service';

import { useLogements } from '../logement.hooks';

export default function LogementListPage() {
  const [capacite, setCapacite] = useState<number | null>(null);
  const { donnees, chargement, erreur } = useLogements('Disponible', capacite);

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Nos hébergements</h1>
      <p className="mt-2 text-slate-600">
        Chambres disponibles à la nuitée, sur place.
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
          Aucun hébergement ne correspond à cette capacité.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {(donnees ?? []).map((logement) => (
          <li
            key={logement.id_logement}
            className="rounded border border-slate-200 bg-white p-4"
          >
            <h2 className="font-medium text-slate-900">
              <Link to={`/logements/${logement.id_logement}`} className="underline">
                {logement.type_chambre}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {logement.capacite} personne(s) — {formaterMontant(logement.tarif_nuitee)}{' '}
              / nuit
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
