/**
 * Formulaire formation, **partagé création et modification**.
 *
 * Les deux ne diffèrent que par les valeurs initiales et l'appel final : deux
 * formulaires divergeraient au jour où un champ serait ajouté à l'un
 * seulement. Même patron que `FormulaireProduit`/`FormulaireSalle`.
 *
 * **Le domaine n'offre que les domaines actifs** : rattacher une formation à
 * un domaine archivé créerait une incohérence qu'aucune vérification
 * ultérieure ne rattraperait à l'affichage — même raisonnement que
 * `FormulaireProduit` pour les catégories.
 */

import { useState } from 'react';

import Bouton from '@/components/ui/Bouton';

import type {
  DomaineFormationAdministration,
  Formation,
  FormationEnvoyee,
} from '../formation.types';

interface Proprietes {
  domaines: DomaineFormationAdministration[];
  /** Formation à modifier, ou `undefined` pour une création. */
  formation?: Formation;
  envoi: boolean;
  erreur: string | null;
  surEnvoi: (donnees: FormationEnvoyee) => void;
  surAnnulation: () => void;
}

function valeursInitiales(
  formation: Formation | undefined,
  domainesActifs: DomaineFormationAdministration[]
): FormationEnvoyee {
  return {
    titre: formation?.titre ?? '',
    niveau: formation?.niveau ?? '',
    duree_heures: formation?.duree_heures ?? 1,
    prix: formation?.prix ?? '0.00',
    capacite_max: formation?.capacite_max ?? 1,
    propose_hebergement: formation?.propose_hebergement ?? false,
    // `0` n'est jamais envoyé tel quel : le composant y substitue le premier
    // domaine actif, la liste n'étant pas connue de cette fonction.
    id_domaine: formation?.id_domaine ?? domainesActifs[0]?.id_domaine ?? 0,
  };
}

export default function FormulaireFormation({
  domaines,
  formation,
  envoi,
  erreur,
  surEnvoi,
  surAnnulation,
}: Proprietes) {
  const actifs = domaines.filter((d) => d.supprime_le === null);
  const [valeurs, setValeurs] = useState<FormationEnvoyee>(() =>
    valeursInitiales(formation, actifs)
  );

  function modifier<C extends keyof FormationEnvoyee>(
    champ: C,
    valeur: FormationEnvoyee[C]
  ) {
    setValeurs((actuelles) => ({ ...actuelles, [champ]: valeur }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        surEnvoi({
          ...valeurs,
          // Chaîne vide normalisée en `null` : `niveau` est facultatif côté
          // serveur, et `""` n'est pas une absence.
          niveau: valeurs.niveau === '' ? null : valeurs.niveau,
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
        Titre
        <input
          type="text"
          required
          value={valeurs.titre}
          onChange={(e) => modifier('titre', e.target.value)}
          className="rounded border border-warm-gray-300 px-2 py-1"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Niveau <span className="text-warm-gray-500">(facultatif)</span>
          <input
            type="text"
            value={valeurs.niveau ?? ''}
            onChange={(e) => modifier('niveau', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Domaine
          <select
            value={valeurs.id_domaine}
            onChange={(e) => modifier('id_domaine', Number(e.target.value))}
            className="rounded border border-warm-gray-300 px-2 py-1"
          >
            {actifs.map((domaine) => (
              <option key={domaine.id_domaine} value={domaine.id_domaine}>
                {domaine.libelle}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Durée (heures)
          <input
            type="number"
            required
            min={1}
            value={valeurs.duree_heures}
            onChange={(e) =>
              modifier('duree_heures', Math.max(1, Number(e.target.value) || 1))
            }
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Prix
          <input
            type="number"
            required
            min={0}
            step="0.01"
            value={valeurs.prix}
            onChange={(e) => modifier('prix', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Capacité maximale
          <input
            type="number"
            required
            min={1}
            value={valeurs.capacite_max}
            onChange={(e) =>
              modifier('capacite_max', Math.max(1, Number(e.target.value) || 1))
            }
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-warm-gray-700">
        <input
          type="checkbox"
          checked={valeurs.propose_hebergement ?? false}
          onChange={(e) => modifier('propose_hebergement', e.target.checked)}
        />
        Propose un hébergement
      </label>

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
        <Bouton type="submit" disabled={envoi || actifs.length === 0}>
          {envoi
            ? 'Enregistrement…'
            : formation === undefined
              ? 'Créer'
              : 'Enregistrer'}
        </Bouton>
        <Bouton variante="secondaire" onClick={surAnnulation}>
          Annuler
        </Bouton>
      </div>
    </form>
  );
}
