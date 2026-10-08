/** Tests de la bascule de langue FR / EN. */

import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';

import { definirLangue, lireLangue } from '@/lib/langue';

import BoutonLangue from './BoutonLangue';

afterEach(() => {
  cleanup();
  act(() => definirLangue('fr'));
  localStorage.clear();
});

it('propose l’anglais en français, et le français en anglais', async () => {
  render(<BoutonLangue />);

  // Le nom du bouton est rédigé dans la langue visée : un visiteur qui ne lit
  // pas la langue courante doit pouvoir la quitter.
  await userEvent.click(screen.getByRole('button', { name: 'Switch to English' }));

  expect(lireLangue()).toBe('en');
  await userEvent.click(screen.getByRole('button', { name: 'Passer en français' }));
  expect(lireLangue()).toBe('fr');
});
