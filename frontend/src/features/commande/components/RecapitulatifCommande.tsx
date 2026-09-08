/**
 * Récapitulatif des lignes d'une commande enregistrée.
 *
 * Porte aussi le bouton « Déposer un avis », par ligne — le module `avis/`
 * fournit le formulaire, cette page ne fait que le monter une fois la
 * commande à son statut terminal (cf. `docs/architecture.md`, réservation ↔
 * catalogue : le module qui déclenche l'action monte le formulaire du module
 * concerné sans rien savoir de son implémentation).
 */

import { useState } from 'react';

import FormulaireAvis from '@/features/avis/components/FormulaireAvis';

import { estTerminee, formaterMontant } from '../commande.service';
import type { Commande, LigneCommandeLue } from '../commande.types';

interface Proprietes {
  commande: Commande;
}

export default function RecapitulatifCommande({ commande }: Proprietes) {
  return (
    <div>
      <ul className="divide-y divide-slate-200">
        {commande.lignes.map((ligne) => (
          <LigneAvecAvis
            key={ligne.id_ligne}
            ligne={ligne}
            proposerAvis={estTerminee(commande)}
          />
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

function LigneAvecAvis({
  ligne,
  proposerAvis,
}: {
  ligne: LigneCommandeLue;
  proposerAvis: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <li className="py-2">
      <div className="flex justify-between">
        <span className="text-slate-900">
          {ligne.nom_produit} × {ligne.quantite}
        </span>
        <span className="text-slate-700">
          {formaterMontant(Number(ligne.prix_unitaire_applique) * ligne.quantite)}
        </span>
      </div>
      {proposerAvis && !ouvert && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="mt-1 text-sm text-slate-900 underline"
        >
          Déposer un avis
        </button>
      )}
      {ouvert && <FormulaireAvis cible="Produit" idCible={ligne.id_ligne} />}
    </li>
  );
}
