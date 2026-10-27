/**
 * Demande de personnalisation d'une ligne, telle qu'enregistrée.
 *
 * Affichée sous la ligne concernée dans le récapitulatif d'une commande —
 * fiche d'administration, historique client, page invitée — pour que
 * l'équipe sache exactement quoi préparer. Le texte garde ses retours à la
 * ligne : une rubrique par ligne (« Message à écrire : … »).
 */

import { Sparkles } from 'lucide-react';

import { urlModele } from '@/features/galerie/galerie.api';
import { useTextes } from '@/lib/langue';

import { TEXTES_COMMANDE } from '../commande.textes';
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
  const t = useTextes(TEXTES_COMMANDE);
  const supplement = Number(personnalisation.supplement_prix);

  return (
    <div className="mt-2 rounded-lg border border-attente/40 bg-attente/10 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold text-gris-700">
        <Sparkles size={15} aria-hidden className="text-attente" />
        {t.personnalisationDemandee}
      </p>
      {personnalisation.photo_modele && (
        <a
          href={urlModele(personnalisation.photo_modele)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block"
        >
          <img
            src={urlModele(personnalisation.photo_modele)}
            alt={t.modeleChoisi}
            className="h-24 w-24 rounded-lg object-cover"
          />
        </a>
      )}
      <p className="mt-1 whitespace-pre-line text-gris-700">
        {personnalisation.description_demande}
      </p>
      {personnalisation.ingredients_specifiques !== null && (
        <p className="mt-1 text-gris-700">
          <span className="font-medium">{t.ingredientsAllergies}</span>{' '}
          {personnalisation.ingredients_specifiques}
        </p>
      )}
      {supplement > 0 && (
        <p className="mt-1 text-xs text-gris-500">
          {t.supplementCalcul(
            formaterMontant(supplement),
            quantite,
            formaterMontant(supplement * quantite)
          )}
        </p>
      )}
    </div>
  );
}
