/** Tests du logo : un seul nom accessible, quelle que soit la forme. */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import LogoDelta from './LogoDelta';

afterEach(cleanup);

it.each(['horizontal', 'symbole', 'complet'] as const)(
  'la forme %s se lit « Delta » une seule fois',
  (forme) => {
    render(<LogoDelta forme={forme} />);

    expect(screen.getAllByRole('img', { name: 'Delta' })).toHaveLength(1);
  }
);

it('le symbole de la forme horizontale est décoratif', () => {
  const { container } = render(<LogoDelta />);

  const images = container.querySelectorAll('img');
  expect(images).toHaveLength(2);
  expect(images[0]?.getAttribute('alt')).toBe('');
});
