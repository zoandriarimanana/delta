/**
 * Une ligne du panier : vignette, nom, prix unitaire, quantité, total, retrait.
 *
 * La vignette est la **couverture** du produit (première photo de sa
 * galerie) ou, à défaut, son illustration — la même image que sur sa fiche,
 * pour que le client reconnaisse ce qu'il a choisi.
 */

import { Link } from 'react-router';
import { Trash2 } from 'lucide-react';

import { urlPhoto } from '@/features/galerie/galerie.api';
import { useGalerie } from '@/features/galerie/galerie.hooks';
import { imageProduit } from '@/lib/images';

import { formaterMontant } from '../commande.service';
import type { LignePanier } from '../commande.types';
import ChampQuantite from './ChampQuantite';

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
  const bien = { produit: ligne.id_produit };
  const { photos } = useGalerie(bien);
  const couverture = photos[0];
  const image =
    couverture !== undefined
      ? urlPhoto(bien, couverture.fichier)
      : imageProduit(ligne.id_produit, ligne.nom);
  const auMaximum = ligne.quantite >= ligne.stock_disponible;

  return (
    <li className="flex gap-4 py-5">
      <Link
        to={`/produits/${ligne.id_produit}`}
        className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-warm-gray-200 sm:h-28 sm:w-28"
      >
        <img src={image} alt="" className="h-full w-full object-cover" />
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
