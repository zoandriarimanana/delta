/**
 * Formulaire abonnement, **partagé création et modification**.
 *
 * Les deux ne diffèrent que par les valeurs initiales, l'appel final, et la
 * présence du sélecteur d'entreprise (`id_client_entreprise` n'est jamais
 * réassignable en modification — cf. `AbonnementModifie`).
 *
 * **La règle croisée est reflétée ici** : le tarif correspondant au
 * `type_facturation` choisi doit être renseigné. Le serveur la vérifie — un
 * `CHECK` en base, doublé du schema d'entrée — et refuse en 422. L'écran la
 * reflète pour que l'utilisateur ne découvre pas le refus après avoir tout
 * saisi ; ce n'est pas la garantie, qui reste côté base.
 */

import { useState } from 'react';

import Bouton from '@/components/ui/Bouton';

import type {
  Abonnement,
  AbonnementEnvoye,
  ClientEntrepriseAdministration,
  ModeSuivi,
  TypeFacturation,
} from '../abonnement.types';

interface Proprietes {
  entreprises: ClientEntrepriseAdministration[];
  /** Abonnement à modifier, ou `undefined` pour une création. */
  abonnement?: Abonnement;
  envoi: boolean;
  erreur: string | null;
  surEnvoi: (donnees: AbonnementEnvoye) => void;
  surAnnulation: () => void;
}

function valeursInitiales(
  abonnement: Abonnement | undefined,
  premiereEntreprise: number
): AbonnementEnvoye {
  return {
    date_debut: abonnement?.date_debut ?? '',
    date_fin: abonnement?.date_fin ?? '',
    type_facturation: abonnement?.type_facturation ?? 'Forfait',
    mode_suivi: abonnement?.mode_suivi ?? 'Global',
    nombre_repas_inclus: abonnement?.nombre_repas_inclus ?? undefined,
    tarif_forfait: abonnement?.tarif_forfait ?? '',
    tarif_unitaire_repas: abonnement?.tarif_unitaire_repas ?? '',
    id_client_entreprise: abonnement?.id_client_entreprise ?? premiereEntreprise,
  };
}

export default function FormulaireAbonnement({
  entreprises,
  abonnement,
  envoi,
  erreur,
  surEnvoi,
  surAnnulation,
}: Proprietes) {
  const [valeurs, setValeurs] = useState<AbonnementEnvoye>(() =>
    valeursInitiales(abonnement, entreprises[0]?.id_client ?? 0)
  );

  function modifier<C extends keyof AbonnementEnvoye>(
    champ: C,
    valeur: AbonnementEnvoye[C]
  ) {
    setValeurs((actuelles) => ({ ...actuelles, [champ]: valeur }));
  }

  // La règle croisée du MLD : le tarif du mode choisi doit être renseigné.
  const tarifManquant =
    valeurs.type_facturation === 'Forfait'
      ? (valeurs.tarif_forfait ?? '').trim() === ''
      : (valeurs.tarif_unitaire_repas ?? '').trim() === '';

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
          tarif_forfait:
            valeurs.type_facturation === 'Forfait' ? valeurs.tarif_forfait : null,
          tarif_unitaire_repas:
            valeurs.type_facturation === 'Consommation_reelle'
              ? valeurs.tarif_unitaire_repas
              : null,
        });
      }}
    >
      {abonnement === undefined && (
        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Entreprise cliente
          <select
            value={valeurs.id_client_entreprise}
            onChange={(e) => modifier('id_client_entreprise', Number(e.target.value))}
            className="rounded border border-warm-gray-300 px-2 py-1"
          >
            {entreprises.map((entreprise) => (
              <option key={entreprise.id_client} value={entreprise.id_client}>
                {entreprise.raison_sociale}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Date de début
          <input
            type="date"
            required
            value={valeurs.date_debut}
            onChange={(e) => modifier('date_debut', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Date de fin
          <input
            type="date"
            required
            value={valeurs.date_fin}
            onChange={(e) => modifier('date_fin', e.target.value)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Type de facturation
          <select
            value={valeurs.type_facturation}
            onChange={(e) =>
              modifier('type_facturation', e.target.value as TypeFacturation)
            }
            className="rounded border border-warm-gray-300 px-2 py-1"
          >
            <option value="Forfait">Forfait</option>
            <option value="Consommation_reelle">Consommation réelle</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
          Mode de suivi
          <select
            value={valeurs.mode_suivi}
            onChange={(e) => modifier('mode_suivi', e.target.value as ModeSuivi)}
            className="rounded border border-warm-gray-300 px-2 py-1"
          >
            <option value="Global">Global</option>
            <option value="Individuel">Individuel</option>
          </select>
        </label>

        {valeurs.type_facturation === 'Forfait' ? (
          <>
            <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
              Tarif forfait
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={valeurs.tarif_forfait ?? ''}
                onChange={(e) => modifier('tarif_forfait', e.target.value)}
                className="rounded border border-warm-gray-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
              Nombre de repas inclus{' '}
              <span className="text-warm-gray-500">(facultatif)</span>
              <input
                type="number"
                min={1}
                value={valeurs.nombre_repas_inclus ?? ''}
                onChange={(e) =>
                  modifier(
                    'nombre_repas_inclus',
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
                className="rounded border border-warm-gray-300 px-2 py-1"
              />
            </label>
          </>
        ) : (
          <label className="flex flex-col gap-1 text-sm text-warm-gray-700">
            Tarif unitaire par repas
            <input
              type="number"
              min={0}
              step="0.01"
              required
              value={valeurs.tarif_unitaire_repas ?? ''}
              onChange={(e) => modifier('tarif_unitaire_repas', e.target.value)}
              className="rounded border border-warm-gray-300 px-2 py-1"
            />
          </label>
        )}
      </div>

      {erreur !== null && (
        <p
          role="alert"
          className="rounded border border-terracotta/30 bg-terracotta/10 p-3 text-sm text-terracotta"
        >
          {erreur}
        </p>
      )}

      <div className="flex gap-2">
        <Bouton
          type="submit"
          disabled={
            envoi ||
            tarifManquant ||
            (abonnement === undefined && entreprises.length === 0)
          }
        >
          {envoi
            ? 'Enregistrement…'
            : abonnement === undefined
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
