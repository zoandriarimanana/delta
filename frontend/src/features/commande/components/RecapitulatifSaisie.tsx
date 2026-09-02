/**
 * Récapitulatif du panier en cours de saisie.
 *
 * Le total vient de `totalPanier`, la fonction pure partagée avec le tunnel
 * client : le calcul ne doit pas exister en deux exemplaires.
 *
 * **Le total affiché est indicatif**, comme celui du panier client : le montant
 * enregistré est calculé par le serveur à partir des prix du catalogue au
 * moment de la commande.
 */

import type { LignePanier } from '../commande.types';
import { formaterMontant } from '../commande.service';

interface Proprietes {
  lignes: LignePanier[];
  total: number;
  surModification: (idProduit: number, quantite: number) => void;
  surRetrait: (idProduit: number) => void;
}

export default function RecapitulatifSaisie({
  lignes,
  total,
  surModification,
  surRetrait,
}: Proprietes) {
  if (lignes.length === 0) {
    return <p className="text-sm text-slate-600">Aucun article sélectionné.</p>;
  }

  return (
    <div>
      <ul className="space-y-2">
        {lignes.map((ligne) => (
          <li
            key={ligne.id_produit}
            className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white p-2"
          >
            <span className="text-sm text-slate-800">{ligne.nom}</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                // Borné au stock connu à l'ajout. Ce n'est pas la garantie : le
                // serveur réserve le stock par un UPDATE conditionnel et refuse
                // en 409 si la quantité n'est plus disponible.
                max={ligne.stock_disponible}
                value={ligne.quantite}
                aria-label={`Quantité pour ${ligne.nom}`}
                onChange={(evenement) =>
                  surModification(ligne.id_produit, Number(evenement.target.value))
                }
                className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => surRetrait(ligne.id_produit)}
                className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-200"
              >
                Retirer
              </button>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-right text-sm font-medium text-slate-900">
        Total indicatif : {formaterMontant(total)}
      </p>
    </div>
  );
}
