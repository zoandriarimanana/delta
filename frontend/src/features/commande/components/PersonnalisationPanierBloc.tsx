/**
 * Personnalisation d'une ligne du panier : résumé, modification, retrait.
 *
 * Le résumé montre au client ce que l'équipe recevra, mot pour mot
 * (`descriptionDemande`) — il peut corriger avant de commander.
 */

import { useState } from 'react';
import { Pencil, Sparkles, X } from 'lucide-react';

import Bouton from '@/components/ui/Bouton';
import { useFormaterPrix } from '@/features/devise/devise.hooks';
import { urlExemple } from '@/features/galerie/galerie.api';
import { useTextes } from '@/lib/langue';

import { TEXTES_COMMANDE } from '../commande.textes';
import { descriptionDemande } from '../commande.service';
import type { LignePanier, PersonnalisationPanier } from '../commande.types';
import ChampsPersonnalisation from './ChampsPersonnalisation';

interface Proprietes {
  ligne: LignePanier & { personnalisation: PersonnalisationPanier };
  surPersonnalisation: (personnalisation: PersonnalisationPanier | null) => void;
}

export default function PersonnalisationPanierBloc({
  ligne,
  surPersonnalisation,
}: Proprietes) {
  const t = useTextes(TEXTES_COMMANDE);
  const prix = useFormaterPrix();
  const [edition, setEdition] = useState(false);
  const [brouillon, setBrouillon] = useState(ligne.personnalisation);
  const supplement = Number(ligne.supplement_personnalisation ?? 0);

  if (edition) {
    return (
      <div className="mt-3 rounded-lg border border-gris-200 bg-gris-100/60 p-3">
        <ChampsPersonnalisation valeurs={brouillon} surChangement={setBrouillon} />
        <div className="mt-3 flex gap-2">
          <Bouton
            onClick={() => {
              surPersonnalisation(brouillon);
              setEdition(false);
            }}
            disabled={descriptionDemande(brouillon) === ''}
          >
            {t.enregistrer}
          </Bouton>
          <Bouton
            variante="secondaire"
            onClick={() => {
              setBrouillon(ligne.personnalisation);
              setEdition(false);
            }}
          >
            {t.annuler}
          </Bouton>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-attente/40 bg-attente/10 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 font-semibold text-gris-700">
          <Sparkles size={15} aria-hidden className="text-attente" />
          {t.personnalise}
          {supplement > 0 && (
            <span className="font-normal text-gris-500">
              {t.parUnite(prix(supplement))}
            </span>
          )}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setEdition(true)}
            aria-label={t.modifierPerso(ligne.nom)}
            className="rounded p-1 text-gris-500 hover:bg-surface hover:text-primaire"
          >
            <Pencil size={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => surPersonnalisation(null)}
            aria-label={t.retirerPerso(ligne.nom)}
            className="rounded p-1 text-gris-500 hover:bg-surface hover:text-primaire"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      </div>
      {ligne.personnalisation.modele !== undefined && (
        <img
          src={urlExemple(ligne.personnalisation.modele)}
          alt={t.modeleChoisi}
          className="mt-2 h-16 w-16 rounded-lg object-cover"
        />
      )}
      <p className="mt-1 whitespace-pre-line text-gris-600">
        {descriptionDemande(ligne.personnalisation, t.rubriques)}
      </p>
      {ligne.personnalisation.ingredients.trim() !== '' && (
        <p className="mt-1 text-gris-600">
          <span className="font-medium">{t.ingredientsAEviter}</span>{' '}
          {ligne.personnalisation.ingredients}
        </p>
      )}
    </div>
  );
}
