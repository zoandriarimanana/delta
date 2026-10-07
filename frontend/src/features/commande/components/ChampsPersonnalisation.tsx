/**
 * Champs guidés d'une personnalisation : message, thème, précisions, ingrédients.
 *
 * Guidés plutôt qu'une seule zone de texte : le client sait quoi écrire, et
 * l'administrateur reçoit une demande rangée par rubriques
 * (`descriptionDemande`). Champs **contrôlés** : la fiche produit et le
 * panier gardent eux-mêmes la saisie, ce composant ne fait que l'afficher.
 */

import type { PersonnalisationPanier } from '../commande.types';

/** Bornes alignées sur `LONGUEUR_DESCRIPTION` côté serveur (2 000), réparties. */
const LONGUEUR_MESSAGE = 120;
const LONGUEUR_RUBRIQUE = 600;

interface Proprietes {
  valeurs: PersonnalisationPanier;
  surChangement: (valeurs: PersonnalisationPanier) => void;
}

const CLASSES_CHAMP =
  'mt-1 block w-full rounded-lg border border-gris-300 bg-white px-3 py-2 text-sm text-gris-700 focus:border-primaire focus:outline-none focus:ring-2 focus:ring-primaire/20';

export default function ChampsPersonnalisation({ valeurs, surChangement }: Proprietes) {
  function modifier(champ: keyof PersonnalisationPanier, valeur: string) {
    surChangement({ ...valeurs, [champ]: valeur });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-gris-700">
          Message à écrire{' '}
          <span className="font-normal text-gris-500">(facultatif)</span>
        </span>
        <input
          maxLength={LONGUEUR_MESSAGE}
          value={valeurs.message}
          onChange={(e) => modifier('message', e.target.value)}
          placeholder="Ex. : Joyeux anniversaire Lova !"
          className={CLASSES_CHAMP}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gris-700">
          Thème et couleurs{' '}
          <span className="font-normal text-gris-500">(facultatif)</span>
        </span>
        <input
          maxLength={LONGUEUR_RUBRIQUE}
          value={valeurs.theme}
          onChange={(e) => modifier('theme', e.target.value)}
          placeholder="Ex. : licornes, rose et blanc"
          className={CLASSES_CHAMP}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gris-700">
          Autres précisions{' '}
          <span className="font-normal text-gris-500">(facultatif)</span>
        </span>
        <textarea
          rows={3}
          maxLength={LONGUEUR_RUBRIQUE}
          value={valeurs.precisions}
          onChange={(e) => modifier('precisions', e.target.value)}
          placeholder="Taille, forme, nombre de parts, date souhaitée…"
          className={CLASSES_CHAMP}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gris-700">
          Ingrédients à éviter ou allergies{' '}
          <span className="font-normal text-gris-500">(facultatif)</span>
        </span>
        <input
          maxLength={LONGUEUR_RUBRIQUE}
          value={valeurs.ingredients}
          onChange={(e) => modifier('ingredients', e.target.value)}
          placeholder="Ex. : sans fruits à coque"
          className={CLASSES_CHAMP}
        />
      </label>
    </div>
  );
}
