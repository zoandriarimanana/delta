/** Vignette d'un produit dans la liste du catalogue. */

import { Link } from 'react-router';

import { estDisponible, formaterPrix } from '../produit.service';
import type { Produit } from '../produit.types';

interface Proprietes {
  produit: Produit;
}

export default function ProduitCarte({ produit }: Proprietes) {
  const disponible = estDisponible(produit);

  return (
    <li className="rounded border border-slate-200 bg-white p-4">
      <Link
        to={`/produits/${produit.id_produit}`}
        className="text-lg font-medium text-slate-900 hover:underline"
      >
        {produit.nom}
      </Link>
      <p className="mt-1 text-slate-700">{formaterPrix(produit)}</p>
      <p
        className={
          disponible ? 'mt-2 text-sm text-emerald-700' : 'mt-2 text-sm text-slate-500'
        }
      >
        {disponible ? `En stock (${produit.stock_disponible})` : 'Épuisé'}
      </p>
    </li>
  );
}
