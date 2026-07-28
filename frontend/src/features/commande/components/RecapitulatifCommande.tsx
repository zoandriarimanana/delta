/** Récapitulatif des lignes d'une commande enregistrée. */

import { formaterMontant } from '../commande.service';
import type { Commande } from '../commande.types';

interface Proprietes {
  commande: Commande;
}

export default function RecapitulatifCommande({ commande }: Proprietes) {
  return (
    <div>
      <ul className="divide-y divide-slate-200">
        {commande.lignes.map((ligne) => (
          <li key={ligne.id_ligne} className="flex justify-between py-2">
            <span className="text-slate-900">
              {ligne.nom_produit} × {ligne.quantite}
            </span>
            <span className="text-slate-700">
              {formaterMontant(Number(ligne.prix_unitaire_applique) * ligne.quantite)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right text-lg font-semibold text-slate-900">
        Total : {formaterMontant(commande.montant_total)}
      </p>
      <p className="mt-1 text-right text-sm text-slate-600">
        Statut : {commande.statut}
      </p>
    </div>
  );
}
