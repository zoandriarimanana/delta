/**
 * Demande de personnalisation d'une ligne, telle qu'enregistrée.
 *
 * Affichée sous la ligne concernée dans le récapitulatif d'une commande —
 * fiche d'administration, historique client, page invitée — pour que
 * l'équipe sache exactement quoi préparer. Le texte garde ses retours à la
 * ligne : une rubrique par ligne (« Message à écrire : … »).
 */

import { Sparkles } from 'lucide-react';

import { formaterMontant } from '../commande.service';
import type { PersonnalisationLue } from '../commande.types';

interface Proprietes {
  personnalisation: PersonnalisationLue;
  quantite: number;
}

export default function DemandePersonnalisationLue({
  personnalisation,
  quantite,
}: Proprietes) {
  const supplement = Number(personnalisation.supplement_prix);

  return (
    <div className="mt-2 rounded-lg border border-amber/40 bg-amber/10 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold text-warm-gray-700">
        <Sparkles size={15} aria-hidden className="text-amber" />
        Personnalisation demandée
      </p>
      <p className="mt-1 whitespace-pre-line text-warm-gray-700">
        {personnalisation.description_demande}
      </p>
      {personnalisation.ingredients_specifiques !== null && (
        <p className="mt-1 text-warm-gray-700">
          <span className="font-medium">Ingrédients à éviter ou allergies :</span>{' '}
          {personnalisation.ingredients_specifiques}
        </p>
      )}
      {supplement > 0 && (
        <p className="mt-1 text-xs text-warm-gray-500">
          Supplément : {formaterMontant(supplement)} × {quantite} ={' '}
          {formaterMontant(supplement * quantite)}
        </p>
      )}
    </div>
  );
}
