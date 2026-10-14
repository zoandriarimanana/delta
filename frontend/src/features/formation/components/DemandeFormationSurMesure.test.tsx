import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import { envoyerDemandeFormation } from '../demandeFormation.api';
import DemandeFormationSurMesure from './DemandeFormationSurMesure';

vi.mock('../demandeFormation.api');

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('envoie une demande de formation sur mesure et remercie', async () => {
  vi.mocked(envoyerDemandeFormation).mockResolvedValue({
    id_demande: 3,
    date_demande: '2026-10-14T09:00:00Z',
  });
  render(<DemandeFormationSurMesure />);

  await userEvent.click(
    screen.getByRole('button', { name: 'Demander une formation sur mesure' })
  );
  await userEvent.type(screen.getByLabelText('Formation souhaitée'), 'Pâte à sucre');
  await userEvent.clear(screen.getByLabelText('Nombre de participants'));
  await userEvent.type(screen.getByLabelText('Nombre de participants'), '6');
  await userEvent.selectOptions(screen.getByLabelText('Lieu'), 'En_entreprise');
  await userEvent.type(screen.getByLabelText('Votre nom'), 'Hery');
  await userEvent.type(screen.getByLabelText('Téléphone ou e-mail'), '0341234567');
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));

  expect(envoyerDemandeFormation).toHaveBeenCalledWith(
    expect.objectContaining({
      sujet: 'Pâte à sucre',
      nombre_participants: 6,
      lieu: 'En_entreprise',
      nom_contact: 'Hery',
      contact: '0341234567',
      niveau: null,
    })
  );
  expect(await screen.findByText(/Demande envoyée, merci/)).toBeDefined();
});

it('dit d’attendre quand le serveur limite les envois', async () => {
  vi.mocked(envoyerDemandeFormation).mockRejectedValue(
    Object.assign(new Error('429'), { isAxiosError: true, response: { status: 429 } })
  );
  render(<DemandeFormationSurMesure />);
  await userEvent.click(
    screen.getByRole('button', { name: 'Demander une formation sur mesure' })
  );
  await userEvent.type(screen.getByLabelText('Formation souhaitée'), 'Pâte à sucre');
  await userEvent.type(screen.getByLabelText('Votre nom'), 'Hery');
  await userEvent.type(screen.getByLabelText('Téléphone ou e-mail'), '0341234567');

  await userEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));

  expect((await screen.findByRole('alert')).textContent).toContain(
    'Réessayez dans une minute'
  );
});
