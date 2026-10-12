/** Règles du mobile money : préfixes, détection, mise en forme. */

import { describe, expect, it } from 'vitest';

import {
  chiffresNumero,
  detecterOperateur,
  formaterNumero,
  numeroComplet,
} from './paiement.service';

describe('numéros mobiles malgaches', () => {
  it.each([
    ['0341234567', 'Mvola'],
    ['0381234567', 'Mvola'],
    ['0321234567', 'Orange_money'],
    ['0371234567', 'Orange_money'],
    ['0331234567', 'Airtel_money'],
    ['+261 34 12 345 67', 'Mvola'],
    ['00261 32 12 345 67', 'Orange_money'],
    ['34 12 345 67', 'Mvola'],
  ])('%s → %s', (numero, operateur) => {
    expect(detecterOperateur(numero)).toBe(operateur);
  });

  it('ne devine rien avant trois chiffres, ni sur un préfixe inconnu', () => {
    expect(detecterOperateur('03')).toBeNull();
    expect(detecterOperateur('0391234567')).toBeNull();
  });

  it('ramène toute écriture à 10 chiffres et la lit par groupes', () => {
    expect(chiffresNumero('+261 34-12.345 67')).toBe('0341234567');
    expect(formaterNumero('0341234567')).toBe('034 12 345 67');
    expect(formaterNumero('03412345678999')).toBe('034 12 345 67');
  });

  it('n’accepte qu’un numéro complet', () => {
    expect(numeroComplet('034 12 345 67')).toBe(true);
    expect(numeroComplet('034 12 345')).toBe(false);
  });
});
