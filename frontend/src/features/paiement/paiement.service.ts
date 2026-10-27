/**
 * Règles du paiement mobile money — fonctions pures.
 *
 * Les préfixes sont **les mêmes que côté serveur** (`schemas/paiement.py`) :
 * pas de portabilité des numéros à Madagascar, le préfixe désigne donc
 * l'opérateur. Le serveur refuse de toute façon un numéro incohérent (422) ;
 * l'écran le détecte pour choisir l'opérateur à la place du client.
 */

import type { FournisseurPaiement } from './paiement.types';

export type Operateur = Exclude<FournisseurPaiement, 'Stripe'>;

export interface InfoOperateur {
  fournisseur: Operateur;
  nom: string;
  /** Réseau mobile qui porte le portefeuille (MVola est le service de Telma). */
  reseau: string;
  prefixes: string[];
  /** Pastille de marque : couleur de fond et de texte. */
  pastille: string;
  initiales: string;
}

export const OPERATEURS: InfoOperateur[] = [
  {
    fournisseur: 'Mvola',
    nom: 'MVola',
    reseau: 'Telma',
    prefixes: ['034', '038'],
    pastille: 'bg-[#FFD200] text-[#1d1d1b]',
    initiales: 'MV',
  },
  {
    fournisseur: 'Orange_money',
    nom: 'Orange Money',
    reseau: 'Orange',
    prefixes: ['032', '037'],
    pastille: 'bg-[#FF7900] text-[#1d1d1b]',
    initiales: 'OM',
  },
  {
    fournisseur: 'Airtel_money',
    nom: 'Airtel Money',
    reseau: 'Airtel',
    prefixes: ['033'],
    pastille: 'bg-[#E40000] text-white',
    initiales: 'AM',
  },
];

/** Chiffres du numéro, ramené à la forme locale (0XX…) si saisi avec +261. */
export function chiffresNumero(saisie: string): string {
  let chiffres = saisie.replace(/\D/g, '');
  if (chiffres.startsWith('00261')) chiffres = '0' + chiffres.slice(5);
  else if (chiffres.startsWith('261')) chiffres = '0' + chiffres.slice(3);
  else if (chiffres.length > 0 && !chiffres.startsWith('0')) chiffres = '0' + chiffres;
  return chiffres.slice(0, 10);
}

/** Opérateur déduit du préfixe, `null` tant qu'on ne peut pas le dire. */
export function detecterOperateur(saisie: string): Operateur | null {
  const prefixe = chiffresNumero(saisie).slice(0, 3);
  return OPERATEURS.find((o) => o.prefixes.includes(prefixe))?.fournisseur ?? null;
}

/** Vrai pour un numéro mobile malgache complet (10 chiffres, 03X). */
export function numeroComplet(saisie: string): boolean {
  return /^03[2-9]\d{7}$/.test(chiffresNumero(saisie));
}

/** « 034 12 345 67 » — la forme sous laquelle un Malgache lit un numéro. */
export function formaterNumero(saisie: string): string {
  const c = chiffresNumero(saisie);
  return [c.slice(0, 3), c.slice(3, 5), c.slice(5, 8), c.slice(8, 10)]
    .filter((partie) => partie !== '')
    .join(' ');
}

export function infoOperateur(fournisseur: Operateur): InfoOperateur {
  return OPERATEURS.find((o) => o.fournisseur === fournisseur) ?? OPERATEURS[0]!;
}
