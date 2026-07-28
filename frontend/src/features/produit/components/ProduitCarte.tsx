/** Vignette d'un produit dans la liste du catalogue. */

import { Link } from 'react-router';

import { usePanier } from '@/features/commande/commande.hooks';

import { estDisponible, formaterPrix } from '../produit.service';
import type { Produit } from '../produit.types';

interface Proprietes {
  produit: Produit;
}

export default function ProduitCarte({ produit }: Proprietes) {
  const disponible = estDisponible(produit);
  const panier = usePanier();

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
      {disponible && (
        <button
          type="button"
          onClick={() => panier.ajouter(produit)}
          aria-label={`Ajouter ${produit.nom} au panier`}
          className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          Ajouter au panier
        </button>
      )}
    </li>
  );
}
