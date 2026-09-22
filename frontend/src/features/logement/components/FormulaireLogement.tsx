/**
 * Formulaire logement, **partagé création et modification**.
 *
 * Les deux ne diffèrent que par les valeurs initiales et l'appel final : deux
 * formulaires divergeraient au jour où un champ serait ajouté à l'un
 * seulement. Même patron que `FormulaireSalle`.
 *
 * **Le champ `statut` n'apparaît qu'en modification.** `LogementCreate` ne
 * l'accepte pas : un logement naît toujours `Disponible` côté serveur, le
 * passer en maintenance est une décision explicite prise ensuite. L'afficher
 * à la création laisserait croire à un choix que le serveur ignorerait.
 */

import { useState } from 'react';

import Bouton from '@/components/ui/Bouton';

import { libelleStatut } from '../logement.service';
import type { Logement, LogementModifie, StatutLogement } from '../logement.types';

const STATUTS: StatutLogement[] = ['Disponible', 'En_maintenance', 'Hors_service'];

interface Proprietes {
  /** Logement à modifier, ou `undefined` pour une création. */
  logement?: Logement;
  envoi: boolean;
  erreur: string | null;
  surEnvoi: (donnees: LogementModifie) => void;
  surAnnulation: () => void;
}

function valeursInitiales(logement?: Logement): LogementModifie {
  return {
    type_chambre: logement?.type_chambre ?? '',
    capacite: logement?.capacite ?? 1,
    tarif_nuitee: logement?.tarif_nuitee ?? '0.00',
    statut: logement?.statut,
  };
}

export default function FormulaireLogement({
  logement,
  envoi,
  erreur,
  surEnvoi,
  surAnnulation,
}: Proprietes) {
  const [valeurs, setValeurs] = useState<LogementModifie>(() =>
    valeursInitiales(logement)
  );

  function modifier<C extends keyof LogementModifie>(
    champ: C,
    valeur: LogementModifie[C]
  ) {
    setValeurs((actuelles) => ({ ...actuelles, [champ]: valeur }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        surEnvoi(
          logement === undefined
            ? {
                type_chambre: valeurs.type_chambre,
                capacite: valeurs.capacite,
                tarif_nuitee: valeurs.tarif_nuitee,
              }
            : valeurs
        );
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
        Type de chambre
        <input
          type="text"
          required
          value={valeurs.type_chambre ?? ''}
          onChange={(e) => modifier('type_chambre', e.target.value)}
          className="rounded border border-warm-gray-300 px-2 py-1"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Capacité
          <input
            type="number"
            required
            min={1}
            value={valeurs.capacite ?? 1}
            onChange={(e) =>
              modifier('capacite', Math.max(1, Number(e.target.value) || 1))
            }
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Tarif à la nuitée
          <input
            type="number"
            required
            min={0}
            step="0.01"
            value={valeurs.tarif_nuitee ?? ''}
            onChange={(e) => modifier('tarif_nuitee', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>
      </div>

      {logement !== undefined && (
        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Statut
          <select
            value={valeurs.statut ?? logement.statut}
            onChange={(e) => modifier('statut', e.target.value as StatutLogement)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          >
            {STATUTS.map((statut) => (
              <option key={statut} value={statut}>
                {libelleStatut(statut)}
              </option>
            ))}
          </select>
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
        <Bouton type="submit" disabled={envoi}>
          {envoi ? 'Enregistrement…' : logement === undefined ? 'Créer' : 'Enregistrer'}
        </Bouton>
        <Bouton variante="secondaire" onClick={surAnnulation}>
          Annuler
        </Bouton>
      </div>
    </form>
  );
}
