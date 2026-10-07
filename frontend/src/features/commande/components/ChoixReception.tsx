/**
 * Choix du mode de réception dans le tunnel : livraison, retrait, sur place.
 *
 * La livraison **exige une adresse** : c'est sa présence, et elle seule, qui
 * crée la `LIVRAISON` et ses frais côté serveur. Avant ce composant, le
 * tunnel proposait « Livraison » sans demander d'adresse — la commande
 * naissait alors sans livraison réelle.
 */

import { MapPin, Store, Truck, UtensilsCrossed } from 'lucide-react';

import type { ModeReception } from '../commande.service';

const MODES: {
  valeur: ModeReception;
  libelle: string;
  detail: string;
  icone: typeof Truck;
}[] = [
  {
    valeur: 'retrait',
    libelle: 'Retrait en boutique',
    detail: 'Aucun frais',
    icone: Store,
  },
  {
    valeur: 'livraison',
    libelle: 'Livraison à domicile',
    detail: 'Livré à l’adresse de votre choix',
    icone: Truck,
  },
  {
    valeur: 'sur_place',
    libelle: 'Sur place',
    detail: 'À consommer chez nous',
    icone: UtensilsCrossed,
  },
];

interface Proprietes {
  mode: ModeReception;
  adresse: string;
  surMode: (mode: ModeReception) => void;
  surAdresse: (adresse: string) => void;
}

export default function ChoixReception({
  mode,
  adresse,
  surMode,
  surAdresse,
}: Proprietes) {
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">
        Comment souhaitez-vous recevoir votre commande ?
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map(({ valeur, libelle, detail, icone: Icone }) => (
          <label
            key={valeur}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 bg-surface p-3 transition-colors ${
              mode === valeur
                ? 'border-primaire'
                : 'border-gris-200 hover:border-gris-300'
            }`}
          >
            <input
              type="radio"
              name="mode-reception"
              value={valeur}
              checked={mode === valeur}
              onChange={() => surMode(valeur)}
              className="sr-only"
            />
            <Icone size={20} aria-hidden className="mt-0.5 shrink-0 text-primaire" />
            <span>
              <span className="block text-sm font-semibold text-gris-700">
                {libelle}
              </span>
              <span className="block text-xs text-gris-500">{detail}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === 'livraison' && (
        <label className="block">
          <span className="flex items-center gap-1.5 text-sm text-gris-700">
            <MapPin size={16} aria-hidden />
            Adresse de livraison
          </span>
          <textarea
            required
            rows={3}
            maxLength={500}
            value={adresse}
            onChange={(evenement) => surAdresse(evenement.target.value)}
            placeholder="Lot, quartier, ville — et un repère si besoin"
            className="mt-1 block w-full rounded-lg border border-gris-300 px-3 py-2"
          />
        </label>
      )}
    </fieldset>
  );
}
