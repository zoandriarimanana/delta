/** Réglage des taux de change par l'administrateur. */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { modifierTaux, recupererTaux } from '../devise.api';
import { oublierTaux } from '../devise.hooks';
import TauxChangePage from './TauxChangePage';

vi.mock('../devise.api');

beforeEach(() => {
  oublierTaux();
  vi.mocked(recupererTaux).mockResolvedValue([
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
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('affiche un formulaire par devise étrangère', async () => {
  render(<TauxChangePage />);

  expect(await screen.findByLabelText(/ariary pour 1 eur/i)).toBeTruthy();
  expect(screen.getByLabelText(/ariary pour 1 usd/i)).toBeTruthy();
});

it('enregistre le nouveau taux d’une devise', async () => {
  vi.mocked(modifierTaux).mockResolvedValue({
    devise: 'EUR',
    ariary_par_unite: '5100.0000',
    mis_a_jour_le: '2026-10-08T11:00:00Z',
  });
  render(<TauxChangePage />);
  const champ = await screen.findByLabelText(/ariary pour 1 eur/i);

  await userEvent.clear(champ);
  await userEvent.type(champ, '5100');
  await userEvent.click(screen.getAllByRole('button', { name: /enregistrer/i })[0]!);

  await waitFor(() => expect(modifierTaux).toHaveBeenCalledWith('EUR', '5100'));
});

it('rend lisible le refus d’un salarié sans droit', async () => {
  vi.mocked(modifierTaux).mockRejectedValue({ response: { status: 403 } });
  render(<TauxChangePage />);
  await screen.findByLabelText(/ariary pour 1 eur/i);

  await userEvent.click(screen.getAllByRole('button', { name: /enregistrer/i })[0]!);

  expect((await screen.findByRole('alert')).textContent).toContain(
    'réservée aux administrateurs'
  );
});
