/** Conversion et mise en forme des montants — fonctions pures. */

import { afterEach, describe, expect, it } from 'vitest';

import { definirLangue } from '@/lib/langue';

import {
  convertir,
  formaterConverti,
  formaterDevise,
  montantAPayer,
} from './devise.service';
import type { TauxChange } from './devise.types';

const TAUX: TauxChange[] = [
  {
    devise: 'EUR',
    ariary_par_unite: '5000.0000',
    mis_a_jour_le: '2026-10-08T10:00:00Z',
  },
  {
    devise: 'USD',
    ariary_par_unite: '4500.0000',
    mis_a_jour_le: '2026-10-08T10:00:00Z',
  },
];

/** Espaces insécables de `Intl` ramenées à des espaces ordinaires. */
const net = (texte: string) => texte.replace(/[  ]/g, ' ');

afterEach(() => definirLangue('fr'));

describe('convertir', () => {
  it('laisse l’Ariary tel quel', () => {
    expect(convertir(25000, 'MGA', TAUX)).toBe(25000);
  });

  it('divise par le taux et arrondit au centime comme le serveur', () => {
    expect(convertir(25000, 'EUR', TAUX)).toBe(5);
    expect(convertir(10000, 'USD', TAUX)).toBe(2.22);
    expect(convertir(10025, 'USD', TAUX)).toBe(2.23);
  });

  it('renvoie null sans taux connu, plutôt qu’un prix inventé', () => {
    expect(convertir(25000, 'EUR', [])).toBeNull();
  });
});

describe('mise en forme', () => {
  it('écrit l’Ariary avec son symbole', () => {
    expect(net(formaterDevise(20000, 'MGA'))).toBe('20 000,00 Ar');
  });

  it('écrit l’euro et le dollar selon la locale', () => {
    expect(net(formaterDevise(4, 'EUR'))).toBe('4,00 €');
    expect(net(formaterDevise(4, 'USD'))).toBe('4,00 $');
    definirLangue('en');
    expect(formaterDevise(4, 'USD')).toBe('$4.00');
  });

  it('retombe sur l’Ariary quand la conversion est impossible', () => {
    expect(net(formaterConverti('25000', 'EUR', []))).toBe('25 000,00 Ar');
    expect(net(formaterConverti('25000', 'EUR', TAUX))).toBe('5,00 €');
  });
});

describe('montantAPayer', () => {
  it('affiche le montant figé dans la devise de la commande', () => {
    expect(
      net(
        montantAPayer({
          devise: 'USD',
          montant_total: '25000.00',
          montant_total_devise: '5.56',
        })
      )
    ).toBe('5,56 $');
  });

  it('vaut l’Ariary pour une commande antérieure, sans devise', () => {
    expect(net(montantAPayer({ montant_total: '25000.00' }))).toBe('25 000,00 Ar');
  });
});
