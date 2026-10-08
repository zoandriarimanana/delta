/**
 * Une ligne du panier : vignette, nom, prix unitaire, quantité, total, retrait.
 */

import { Link } from 'react-router';
import { Trash2 } from 'lucide-react';

import { useFormaterPrix } from '@/features/devise/devise.hooks';

import { supplementLigne } from '../commande.service';
import type { LignePanier, PersonnalisationPanier } from '../commande.types';
import ChampQuantite from './ChampQuantite';
import PersonnalisationPanierBloc from './PersonnalisationPanierBloc';
import VignetteProduit from './VignetteProduit';

interface Proprietes {
  ligne: LignePanier;
  surQuantite: (quantite: number) => void;
  surRetrait: () => void;
  surPersonnalisation: (personnalisation: PersonnalisationPanier | null) => void;
}

export default function LignePanierCarte({
  ligne,
  surQuantite,
  surRetrait,
  surPersonnalisation,
}: Proprietes) {
  const prix = useFormaterPrix();
  const { personnalisation } = ligne;
  // À la personne, le stock compte des gâteaux, pas des personnes.
  const auMaximum =
    !ligne.vendu_par_personne && ligne.quantite >= ligne.stock_disponible;

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
            className="font-semibold text-gris-700 no-underline hover:text-primaire"
          >
            {ligne.nom}
          </Link>
          <p className="mt-1 text-sm text-gris-500">
            {prix(ligne.prix_unitaire)} / {ligne.unite_mesure}
          </p>
          <div className="mt-3 flex items-center gap-4">
            <ChampQuantite ligne={ligne} onChangement={surQuantite} />
            {ligne.vendu_par_personne && (
              <span className="text-sm text-gris-500">personnes</span>
            )}
            <button
              type="button"
              onClick={surRetrait}
              aria-label={`Retirer ${ligne.nom}`}
              className="inline-flex items-center gap-1.5 text-sm text-gris-500 transition-colors hover:text-primaire"
            >
              <Trash2 size={16} aria-hidden />
              Retirer
            </button>
          </div>
          {auMaximum && (
            <p className="mt-2 text-xs text-attente">
              Quantité maximale disponible en stock.
            </p>
          )}
          {personnalisation !== undefined && (
            <PersonnalisationPanierBloc
              ligne={{ ...ligne, personnalisation }}
              surPersonnalisation={surPersonnalisation}
            />
          )}
        </div>

        <p className="whitespace-nowrap text-lg font-semibold text-gris-700 sm:text-right">
          {prix(Number(ligne.prix_unitaire) * ligne.quantite + supplementLigne(ligne))}
        </p>
      </div>
    </li>
  );
}
