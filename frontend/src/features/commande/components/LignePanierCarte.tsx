/**
 * Une ligne du panier : vignette, nom, prix unitaire, quantité, total, retrait.
 */

import { Link } from 'react-router';
import { Trash2 } from 'lucide-react';

import { formaterMontant } from '../commande.service';
import type { LignePanier } from '../commande.types';
import ChampQuantite from './ChampQuantite';
import VignetteProduit from './VignetteProduit';

interface Proprietes {
  ligne: LignePanier;
  surQuantite: (quantite: number) => void;
  surRetrait: () => void;
}

export default function LignePanierCarte({
  ligne,
  surQuantite,
  surRetrait,
}: Proprietes) {
  const auMaximum = ligne.quantite >= ligne.stock_disponible;

  return (
    <li className="flex gap-4 py-5">
      <Link to={`/produits/${ligne.id_produit}`} className="shrink-0">
        <VignetteProduit
          idProduit={ligne.id_produit}
          nom={ligne.nom}
          className="h-24 w-24 sm:h-28 sm:w-28"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to={`/produits/${ligne.id_produit}`}
            className="font-semibold text-warm-gray-700 no-underline hover:text-terracotta"
          >
            {ligne.nom}
          </Link>
          <p className="mt-1 text-sm text-warm-gray-500">
            {formaterMontant(ligne.prix_unitaire)} / {ligne.unite_mesure}
          </p>
          <div className="mt-3 flex items-center gap-4">
            <ChampQuantite ligne={ligne} onChangement={surQuantite} />
            <button
              type="button"
              onClick={surRetrait}
              aria-label={`Retirer ${ligne.nom}`}
              className="inline-flex items-center gap-1.5 text-sm text-warm-gray-500 transition-colors hover:text-terracotta"
            >
              <Trash2 size={16} aria-hidden />
              Retirer
            </button>
          </div>
          {auMaximum && (
            <p className="mt-2 text-xs text-amber">
              Quantité maximale disponible en stock.
            </p>
          )}
        </div>

        <p className="whitespace-nowrap text-lg font-semibold text-warm-gray-700 sm:text-right">
          {formaterMontant(Number(ligne.prix_unitaire) * ligne.quantite)}
        </p>
      </div>
    </li>
  );
}
