/**
 * Bloc d'achat de la fiche produit : quantité, ajout au panier, confirmation.
 *
 * Extrait de `ProduitDetailPage` pour que la page reste une mise en page : la
 * saisie et son état local vivent ici.
 *
 * La quantité est bornée au stock **à l'affichage seulement** — c'est
 * `ajouterAuPanier` qui garantit la borne, et le serveur qui tranche à la
 * commande. Le panier reste un brouillon, pas une réservation de stock.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { Check, Minus, Plus, ShoppingCart } from 'lucide-react';

import { usePanier } from '@/features/commande/commande.hooks';

import type { Produit } from '../produit.types';

interface Proprietes {
  produit: Produit;
}

const CLASSES_PAS =
  'flex h-11 w-11 items-center justify-center text-warm-gray-600 transition-colors hover:bg-warm-gray-100 disabled:cursor-not-allowed disabled:opacity-40';

export default function AjoutPanierProduit({ produit }: Proprietes) {
  const panier = usePanier();
  const [quantite, setQuantite] = useState(1);
  const [ajoute, setAjoute] = useState(false);
  const maximum = produit.stock_disponible;

  function changer(valeur: number) {
    setQuantite(Math.min(Math.max(valeur, 1), maximum));
    // Une nouvelle quantité appelle un nouvel ajout : la confirmation
    // précédente ne doit pas laisser croire qu'il a déjà eu lieu.
    setAjoute(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div
          role="group"
          aria-label="Quantité"
          className="flex w-fit items-center overflow-hidden rounded-full border border-warm-gray-300 bg-white"
        >
          <button
            type="button"
            onClick={() => changer(quantite - 1)}
            disabled={quantite <= 1}
            aria-label="Diminuer la quantité"
            className={CLASSES_PAS}
          >
            <Minus size={16} aria-hidden />
          </button>
          <span
            aria-live="polite"
            className="min-w-10 text-center font-semibold text-warm-gray-700"
          >
            {quantite}
          </span>
          <button
            type="button"
            onClick={() => changer(quantite + 1)}
            disabled={quantite >= maximum}
            aria-label="Augmenter la quantité"
            className={CLASSES_PAS}
          >
            <Plus size={16} aria-hidden />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            panier.ajouter(produit, quantite);
            setAjoute(true);
          }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3 font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-burgundy hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta active:translate-y-0"
        >
          <ShoppingCart size={20} aria-hidden />
          Ajouter au panier
        </button>
      </div>

      {ajoute && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg bg-sage/15 px-4 py-2 text-sm text-sage"
        >
          <Check size={16} aria-hidden />
          Ajouté au panier.
          <Link to="/panier" className="font-semibold underline">
            Voir le panier
          </Link>
        </p>
      )}
    </div>
  );
}
