/**
 * Champs guidés d'une personnalisation : message, thème, précisions, ingrédients.
 *
 * Guidés plutôt qu'une seule zone de texte : le client sait quoi écrire, et
 * l'administrateur reçoit une demande rangée par rubriques
 * (`descriptionDemande`). Champs **contrôlés** : la fiche produit et le
 * panier gardent eux-mêmes la saisie, ce composant ne fait que l'afficher.
 */

import { X } from 'lucide-react';

import ExemplesRealisations from '@/features/galerie/components/ExemplesRealisations';
import { urlExemple, type SourceModele } from '@/features/galerie/galerie.api';
import { useTextes } from '@/lib/langue';

import { TEXTES_COMMANDE } from '../commande.textes';
import type { PersonnalisationPanier } from '../commande.types';

/** Bornes alignées sur `LONGUEUR_DESCRIPTION` côté serveur (2 000), réparties. */
const LONGUEUR_MESSAGE = 120;
const LONGUEUR_RUBRIQUE = 600;

interface Proprietes {
  valeurs: PersonnalisationPanier;
  surChangement: (valeurs: PersonnalisationPanier) => void;
  /**
   * Catégorie du produit : ses exemples de réalisations sont proposés comme
   * modèles. Absente (panier), seul le modèle déjà retenu s'affiche. Les
   * photos du produit lui-même se choisissent dans sa galerie.
   */
  idCategorie?: number;
}

/** La saisie sans le modèle retenu — retirer un modèle, c'est omettre la clé. */
function sansModele(v: PersonnalisationPanier): PersonnalisationPanier {
  return {
    message: v.message,
    theme: v.theme,
    precisions: v.precisions,
    ingredients: v.ingredients,
  };
}

const CLASSES_CHAMP =
  'mt-1 block w-full rounded-lg border border-gris-300 bg-surface px-3 py-2 text-sm text-gris-700 focus:border-primaire focus:outline-none focus:ring-2 focus:ring-primaire/20';

export default function ChampsPersonnalisation({
  valeurs,
  surChangement,
  idCategorie,
}: Proprietes) {
  const t = useTextes(TEXTES_COMMANDE);
  const source = valeurs.modeleSource ?? 'categories';
  function choisir(modele: string | undefined, depuis: SourceModele) {
    const reste = sansModele(valeurs);
    surChangement(
      modele === undefined ? reste : { ...reste, modele, modeleSource: depuis }
    );
  }
  function modifier(champ: keyof PersonnalisationPanier, valeur: string) {
    surChangement({ ...valeurs, [champ]: valeur });
  }

  return (
    <div className="space-y-3">
      {idCategorie !== undefined ? (
        <ExemplesRealisations
          bien={{ categorie: idCategorie }}
          titre={t.choisirModele}
          choix={source === 'categories' ? valeurs.modele : undefined}
          surChoix={(modele) => choisir(modele, 'categories')}
          libelleChoix={t.jeVeuxCeModele}
        />
      ) : (
        valeurs.modele !== undefined && (
          <div className="flex items-center gap-3">
            <img
              src={urlExemple(valeurs.modele, source)}
              alt={t.modeleChoisi}
              className="h-16 w-16 rounded-lg object-cover"
            />
            <span className="text-sm font-medium text-gris-700">{t.modeleChoisi}</span>
            <button
              type="button"
              onClick={() => {
                const reste = sansModele(valeurs);
                surChangement(reste);
              }}
              className="ml-auto inline-flex items-center gap-1 text-sm text-danger hover:underline"
            >
              <X size={14} aria-hidden />
              {t.retirerModele}
            </button>
          </div>
        )
      )}
      <label className="block">
        <span className="text-sm font-medium text-gris-700">
          {t.champMessage}{' '}
          <span className="font-normal text-gris-500">{t.facultatif}</span>
        </span>
        <input
          maxLength={LONGUEUR_MESSAGE}
          value={valeurs.message}
          onChange={(e) => modifier('message', e.target.value)}
          placeholder={t.exempleMessage}
          className={CLASSES_CHAMP}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gris-700">
          {t.champTheme}{' '}
          <span className="font-normal text-gris-500">{t.facultatif}</span>
        </span>
        <input
          maxLength={LONGUEUR_RUBRIQUE}
          value={valeurs.theme}
          onChange={(e) => modifier('theme', e.target.value)}
          placeholder={t.exempleTheme}
          className={CLASSES_CHAMP}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gris-700">
          {t.champPrecisions}{' '}
          <span className="font-normal text-gris-500">{t.facultatif}</span>
        </span>
        <textarea
          rows={3}
          maxLength={LONGUEUR_RUBRIQUE}
          value={valeurs.precisions}
          onChange={(e) => modifier('precisions', e.target.value)}
          placeholder={t.exemplePrecisions}
          className={CLASSES_CHAMP}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gris-700">
          {t.champIngredients}{' '}
          <span className="font-normal text-gris-500">{t.facultatif}</span>
        </span>
        <input
          maxLength={LONGUEUR_RUBRIQUE}
          value={valeurs.ingredients}
          onChange={(e) => modifier('ingredients', e.target.value)}
          placeholder={t.exempleIngredients}
          className={CLASSES_CHAMP}
        />
      </label>
    </div>
  );
}
