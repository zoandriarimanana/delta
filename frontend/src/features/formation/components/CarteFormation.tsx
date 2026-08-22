/** Une formation dans le catalogue. */

import { Link } from 'react-router';

import { formaterMontant } from '@/features/commande/commande.service';

import { formaterDuree } from '../formation.service';
import type { Formation } from '../formation.types';

export default function CarteFormation({ formation }: { formation: Formation }) {
  return (
    <li className="rounded border border-slate-200 bg-white p-4">
      <h2 className="font-medium text-slate-900">
        <Link to={`/formations/${formation.id_formation}`} className="underline">
          {formation.titre}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {formaterDuree(formation.duree_heures)}
        {formation.niveau !== null && <> — niveau {formation.niveau}</>}
      </p>
      <p className="mt-1 text-sm text-slate-700">{formaterMontant(formation.prix)}</p>
      {formation.propose_hebergement && (
        <p className="mt-1 text-sm text-slate-500">Hébergement possible</p>
      )}
    </li>
  );
}
