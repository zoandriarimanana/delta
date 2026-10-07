/** Tests de l'interrupteur clair / sombre. */

import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';

import { definirTheme } from '@/lib/theme';

import BoutonTheme from './BoutonTheme';

afterEach(() => {
  cleanup();
  act(() => definirTheme('clair'));
  localStorage.clear();
});

it('bascule entre clair et sombre, en annonçant le mode visé', async () => {
  act(() => definirTheme('clair'));
  render(<BoutonTheme />);

  await userEvent.click(screen.getByRole('button', { name: 'Activer le mode sombre' }));

  expect(document.documentElement.classList.contains('dark')).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Activer le mode clair' }));
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});

it('affiche un libellé visible dans la barre latérale', () => {
  act(() => definirTheme('sombre'));
  render(<BoutonTheme avecLibelle />);

  expect(screen.getByText('Mode clair')).toBeDefined();
});
