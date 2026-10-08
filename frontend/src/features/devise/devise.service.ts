/**
 * Conversion et mise en forme des montants — fonctions pures.
 *
 * Le catalogue est tenu en Ariary. Une conversion faite ici est
 * **indicative** : le montant payé est celui que le serveur calcule et fige
 * à la commande (`COMMANDE.montant_total_devise`), avec le taux du moment.
 * Même arrondi que le serveur (au centime, au demi supérieur), pour que
 * l'indication et le montant final coïncident tant que le taux ne bouge pas.
 */

import { localeCourante } from '@/lib/langue';

import type { Devise, TauxChange } from './devise.types';

export const DEVISES: Devise[] = ['MGA', 'EUR', 'USD'];

/** Nom court affiché dans les sélecteurs. */
export const NOMS_DEVISES: Record<Devise, string> = {
  MGA: 'Ar — Ariary',
  EUR: '€ — Euro',
  USD: '$ — Dollar US',
};

export const SYMBOLES_DEVISES: Record<Devise, string> = {
  MGA: 'Ar',
  EUR: '€',
  USD: '$',
};


/**
 * Convertit un montant en Ariary dans `devise`.
 *
 * `null` si le taux de cette devise n'est pas (encore) connu : l'appelant
 * retombe alors sur l'Ariary plutôt que d'afficher un prix inventé.
 */
export function convertir(
  montantAriary: number,
  devise: Devise,
  taux: TauxChange[]
): number | null {
  if (devise === 'MGA') return montantAriary;
  const ligne = taux.find((t) => t.devise === devise);
  const parUnite = ligne ? Number(ligne.ariary_par_unite) : NaN;
  if (!(parUnite > 0)) return null;
  // Arrondi au centime, demi supérieur — comme `TauxChangeService.convertir`.
  return Math.round((montantAriary / parUnite) * 100 + Number.EPSILON) / 100;
}

/** Met en forme un montant déjà exprimé dans `devise`. */
export function formaterDevise(montant: number | string, devise: Devise): string {
  const nombre = Number(montant);
  if (Number.isNaN(nombre)) return `${montant} ${SYMBOLES_DEVISES[devise]}`;
  if (devise === 'MGA') {
    const valeur = new Intl.NumberFormat(localeCourante(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(nombre);
    return `${valeur} Ar`;
  }
  return new Intl.NumberFormat(localeCourante(), {
    style: 'currency',
    currency: devise,
    currencyDisplay: 'narrowSymbol',
  }).format(nombre);
}

/**
 * Met en forme un montant en Ariary dans `devise`, ou en Ariary si la
 * conversion est impossible.
 */
export function formaterConverti(
  montantAriary: number | string,
  devise: Devise,
  taux: TauxChange[]
): string {
  const nombre = Number(montantAriary);
  const converti = Number.isNaN(nombre) ? null : convertir(nombre, devise, taux);
  return converti === null
    ? formaterDevise(montantAriary, 'MGA')
    : formaterDevise(converti, devise);
}

/** Montant à payer d'une commande enregistrée, dans **sa** devise figée. */
export function montantAPayer(commande: {
  devise?: Devise;
  montant_total: string;
  montant_total_devise?: string;
}): string {
  const devise = commande.devise ?? 'MGA';
  return devise === 'MGA' || commande.montant_total_devise === undefined
    ? formaterDevise(commande.montant_total, 'MGA')
    : formaterDevise(commande.montant_total_devise, devise);
}
