/**
 * Formulaire produit, **partagé création et modification**.
 *
 * Les deux ne diffèrent que par les valeurs initiales et l'appel final : deux
 * formulaires divergeraient au jour où un champ serait ajouté à l'un seulement.
 *
 * **La règle croisée est reflétée ici** : un produit personnalisable doit
 * porter un tarif. Le serveur la vérifie — un `CHECK` en base, doublé du schema
 * d'entrée — et refuse en 422. L'écran la reflète pour que l'utilisateur ne
 * découvre pas le refus après avoir tout saisi ; ce n'est pas la garantie, qui
 * reste côté base.
 */

import { useState } from 'react';

import Bouton from '@/components/ui/Bouton';

import type {
  CategorieProduitAdministration,
  Produit,
  ProduitEnvoye,
} from '../produit.types';

interface Proprietes {
  categories: CategorieProduitAdministration[];
  /** Produit à modifier, ou `undefined` pour une création. */
  produit?: Produit;
  envoi: boolean;
  erreur: string | null;
  surEnvoi: (donnees: ProduitEnvoye) => void;
  surAnnulation: () => void;
}

function valeursInitiales(produit?: Produit): ProduitEnvoye {
  return {
    nom: produit?.nom ?? '',
    description: produit?.description ?? '',
    prix_unitaire: produit?.prix_unitaire ?? '0.00',
    unite_mesure: produit?.unite_mesure ?? 'piece',
    stock_disponible: produit?.stock_disponible ?? 0,
    est_personnalisable: produit?.est_personnalisable ?? false,
    supplement_personnalisation: produit?.supplement_personnalisation ?? '',
    est_livrable: produit?.est_livrable ?? true,
    // `0` n'est jamais envoyé tel quel : le composant y substitue la première
    // catégorie active, la liste n'étant pas connue de cette fonction.
    id_categorie: produit?.id_categorie ?? 0,
  };
}

export default function FormulaireProduit({
  categories,
  produit,
  envoi,
  erreur,
  surEnvoi,
  surAnnulation,
}: Proprietes) {
  const actives = categories.filter((c) => c.supprime_le === null);
  const [valeurs, setValeurs] = useState<ProduitEnvoye>(() => {
    const base = valeursInitiales(produit);
    // Une catégorie est obligatoire : à la création, la première active fait un
    // défaut raisonnable plutôt qu'un `0` que le serveur refuserait en 422.
    return base.id_categorie === 0 && actives[0] !== undefined
      ? { ...base, id_categorie: actives[0].id_categorie }
      : base;
  });

  function modifier<C extends keyof ProduitEnvoye>(champ: C, valeur: ProduitEnvoye[C]) {
    setValeurs((actuelles) => ({ ...actuelles, [champ]: valeur }));
  }

  // La règle croisée du MLD : personnalisable ⇒ tarif renseigné.
  const tarifManquant =
    valeurs.est_personnalisable &&
    (valeurs.supplement_personnalisation ?? '').trim() === '';

  return (
    <form
      className="space-y-4"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        if (tarifManquant) {
          return;
        }
        surEnvoi({
          ...valeurs,
          // Chaînes vides normalisées en `null` : le serveur attend une absence,
          // pas une chaîne, et `""` échouerait sur un champ décimal.
          description: valeurs.description === '' ? null : valeurs.description,
          supplement_personnalisation: valeurs.est_personnalisable
            ? valeurs.supplement_personnalisation
            : null,
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
        Nom
        <input
          type="text"
          required
          value={valeurs.nom}
          onChange={(e) => modifier('nom', e.target.value)}
          className="rounded border border-warm-gray-300 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
        Description <span className="text-warm-gray-500">(facultative)</span>
        <textarea
          value={valeurs.description ?? ''}
          onChange={(e) => modifier('description', e.target.value)}
          className="rounded border border-warm-gray-300 px-2 py-1"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Prix unitaire
          <input
            type="number"
            required
            min={0}
            step="0.01"
            value={valeurs.prix_unitaire}
            onChange={(e) => modifier('prix_unitaire', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Unité de mesure
          <input
            type="text"
            required
            value={valeurs.unite_mesure}
            onChange={(e) => modifier('unite_mesure', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Stock disponible
          <input
            type="number"
            min={0}
            value={valeurs.stock_disponible}
            onChange={(e) =>
              modifier('stock_disponible', Math.max(0, Number(e.target.value) || 0))
            }
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Catégorie
          <select
            value={valeurs.id_categorie}
            onChange={(e) => modifier('id_categorie', Number(e.target.value))}
            className="rounded border border-warm-gray-300 px-2 py-1"
          >
            {actives.map((categorie) => (
              <option key={categorie.id_categorie} value={categorie.id_categorie}>
                {categorie.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-warm-gray-700">
        <input
          type="checkbox"
          checked={valeurs.est_livrable}
          onChange={(e) => modifier('est_livrable', e.target.checked)}
        />
        Livrable
      </label>

      <label className="flex items-center gap-2 text-sm text-warm-gray-700">
        <input
          type="checkbox"
          checked={valeurs.est_personnalisable}
          onChange={(e) => modifier('est_personnalisable', e.target.checked)}
        />
        Personnalisable
      </label>

      {valeurs.est_personnalisable && (
        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Supplément de personnalisation, par unité
          <input
            type="number"
            min={0}
            step="0.01"
            required
            value={valeurs.supplement_personnalisation ?? ''}
            onChange={(e) => modifier('supplement_personnalisation', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
          <span className="text-xs text-warm-gray-500">
            Obligatoire dès qu’un produit est personnalisable.
          </span>
        </label>
      )}

      {erreur !== null && (
        // Le message du serveur est repris tel quel : il dit quoi corriger.
        <p
          role="alert"
          className="rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {erreur}
        </p>
      )}

      <div className="flex gap-2">
        <Bouton type="submit" disabled={envoi || tarifManquant || actives.length === 0}>
          {envoi ? 'Enregistrement…' : produit === undefined ? 'Créer' : 'Enregistrer'}
        </Bouton>
        <Bouton variante="secondaire" onClick={surAnnulation}>
          Annuler
        </Bouton>
      </div>
    </form>
  );
}
