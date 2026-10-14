import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Prix from './Prix';

describe('Prix', () => {
  it('s’affiche toujours en Ariary', () => {
    render(<Prix montant="20000" />);

    expect(screen.getByText(/20\s?000,00 Ar/)).toBeDefined();
    expect(screen.queryByText(/\$|€/)).toBeNull();
  });
});
