/**
 * Formulaire salle, **partagé création et modification**.
 *
 * Les deux ne diffèrent que par les valeurs initiales et l'appel final : deux
 * formulaires divergeraient au jour où un champ serait ajouté à l'un
 * seulement. Même patron que `FormulaireProduit`.
 *
 * **La règle croisée est reflétée ici** : une salle doit porter au moins un
 * tarif, horaire ou journalier (#45). Le serveur la vérifie — un `CHECK` en
 * base, doublé du schema d'entrée — et refuse en 422. L'écran la reflète pour
 * que l'utilisateur ne découvre pas le refus après avoir tout saisi ; ce
 * n'est pas la garantie, qui reste côté base.
 */

import { useState } from 'react';

import Bouton from '@/components/ui/Bouton';

import type { Salle, SalleEnvoyee } from '../salle.types';

interface Proprietes {
  /** Salle à modifier, ou `undefined` pour une création. */
  salle?: Salle;
  envoi: boolean;
  erreur: string | null;
  surEnvoi: (donnees: SalleEnvoyee) => void;
  surAnnulation: () => void;
}

function valeursInitiales(salle?: Salle): SalleEnvoyee {
  return {
    nom: salle?.nom ?? '',
    capacite: salle?.capacite ?? 1,
    tarif_horaire: salle?.tarif_horaire ?? '',
    tarif_journee: salle?.tarif_journee ?? '',
    equipements: salle?.equipements ?? '',
  };
}

export default function FormulaireSalle({
  salle,
  envoi,
  erreur,
  surEnvoi,
  surAnnulation,
}: Proprietes) {
  const [valeurs, setValeurs] = useState<SalleEnvoyee>(() => valeursInitiales(salle));

  function modifier<C extends keyof SalleEnvoyee>(champ: C, valeur: SalleEnvoyee[C]) {
    setValeurs((actuelles) => ({ ...actuelles, [champ]: valeur }));
  }

  // La règle du MLD (#45) : au moins un des deux tarifs, jamais aucun.
  const sansTarif =
    (valeurs.tarif_horaire ?? '').trim() === '' &&
    (valeurs.tarif_journee ?? '').trim() === '';

  return (
    <form
      className="space-y-4"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        if (sansTarif) {
          return;
        }
        surEnvoi({
          ...valeurs,
          // Chaîne vide normalisée en `null` : le serveur attend une absence,
          // pas une chaîne, et `""` échouerait sur un champ décimal.
          tarif_horaire:
            (valeurs.tarif_horaire ?? '').trim() === '' ? null : valeurs.tarif_horaire,
          tarif_journee:
            (valeurs.tarif_journee ?? '').trim() === '' ? null : valeurs.tarif_journee,
          equipements: valeurs.equipements === '' ? null : valeurs.equipements,
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
        Capacité
        <input
          type="number"
          required
          min={1}
          value={valeurs.capacite}
          onChange={(e) =>
            modifier('capacite', Math.max(1, Number(e.target.value) || 1))
          }
          className="rounded border border-warm-gray-300 px-2 py-1"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Tarif horaire
          <input
            type="number"
            min={0}
            step="0.01"
            value={valeurs.tarif_horaire ?? ''}
            onChange={(e) => modifier('tarif_horaire', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Tarif journalier
          <input
            type="number"
            min={0}
            step="0.01"
            value={valeurs.tarif_journee ?? ''}
            onChange={(e) => modifier('tarif_journee', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>
      </div>

      {sansTarif && (
        <p className="text-xs text-warm-gray-500">
          Au moins un tarif est requis, horaire ou journalier. Pour une salle gratuite,
          indiquer 0.
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
        Équipements <span className="text-warm-gray-500">(facultatif)</span>
        <textarea
          value={valeurs.equipements ?? ''}
          onChange={(e) => modifier('equipements', e.target.value)}
          className="rounded border border-warm-gray-300 px-2 py-1"
        />
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
        <Bouton type="submit" disabled={envoi || sansTarif}>
          {envoi ? 'Enregistrement…' : salle === undefined ? 'Créer' : 'Enregistrer'}
        </Bouton>
        <Bouton variante="secondaire" onClick={surAnnulation}>
          Annuler
        </Bouton>
      </div>
    </form>
  );
}
