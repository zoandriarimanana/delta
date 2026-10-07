/** Tests de l'écran de réglage du tarif de livraison. */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { modifierTarifLivraison, recupererTarifLivraison } from '../livraison.api';
import TarifLivraisonPage from './TarifLivraisonPage';

vi.mock('../livraison.api');

beforeEach(() => {
  vi.mocked(recupererTarifLivraison).mockResolvedValue({
    forfait: '5000.00',
    seuil_gratuite: '100000.00',
  });
  vi.mocked(modifierTarifLivraison).mockResolvedValue({
    forfait: '4000.00',
    seuil_gratuite: null,
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('affiche le tarif en vigueur', async () => {
  render(<TarifLivraisonPage />);

  expect(await screen.findByText(/Actuellement/)).toBeDefined();
  // Les champs sont remplis par un effet, après le premier rendu du tarif.
  await waitFor(() =>
    expect(screen.getByLabelText(/Forfait de livraison/)).toHaveProperty(
      'value',
      '5000.00'
    )
  );
  expect(screen.getByLabelText(/Livraison offerte dès/)).toHaveProperty(
    'value',
    '100000.00'
  );
});

it('retirer la gratuité envoie un seuil nul', async () => {
  render(<TarifLivraisonPage />);
  const forfait = await screen.findByLabelText(/Forfait de livraison/);

  await userEvent.clear(forfait);
  await userEvent.type(forfait, '4000');
  await userEvent.click(screen.getByLabelText(/Offrir la livraison/));
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

  await waitFor(() =>
    expect(modifierTarifLivraison).toHaveBeenCalledWith({
      forfait: '4000',
      seuil_gratuite: null,
    })
  );
  expect(await screen.findByRole('status')).toBeDefined();
});

it('explique un refus de droits', async () => {
  vi.mocked(modifierTarifLivraison).mockRejectedValue({ response: { status: 403 } });
  render(<TarifLivraisonPage />);
  await screen.findByLabelText(/Forfait de livraison/);

  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

  expect((await screen.findByRole('alert')).textContent).toContain('administrateurs');
});
