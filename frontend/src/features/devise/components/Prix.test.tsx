import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { definirDevise } from '../devise.store';
import Prix from './Prix';

describe('Prix', () => {
  afterEach(() => act(() => definirDevise('MGA')));

  it('reste en Ariary même après un paiement choisi en dollars', () => {
    // Demande du 12 octobre 2026 : la devise du tunnel ne décide que du
    // paiement, jamais des prix affichés.
    act(() => definirDevise('USD'));

    render(<Prix montant="20000" />);

    expect(screen.getByText(/20\s?000,00 Ar/)).toBeDefined();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('n’est plus mémorisé d’une visite à l’autre', () => {
    act(() => definirDevise('EUR'));

    expect(localStorage.getItem('delta.devise')).toBeNull();
  });
});
