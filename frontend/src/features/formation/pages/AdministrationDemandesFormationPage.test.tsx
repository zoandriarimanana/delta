import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import {
  recupererDemandesFormation,
  suivreDemandeFormation,
} from '../demandeFormation.api';
import type { DemandeFormation } from '../demandeFormation.types';
import AdministrationDemandesFormationPage from './AdministrationDemandesFormationPage';

vi.mock('../demandeFormation.api');

const DEMANDE: DemandeFormation = {
  id_demande: 3,
  sujet: 'Pâte à sucre',
  nombre_participants: 6,
  niveau: 'Débutant',
  periode_souhaitee: 'Novembre',
  lieu: 'Chez_delta',
  message: 'Pour une boulangerie.',
  nom_contact: 'Hery Rakoto',
  contact: '034 12 345 67',
  statut: 'Nouvelle',
  note_interne: null,
  date_demande: '2026-10-14T09:00:00Z',
  id_client: null,
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('montre la demande, qui rappeler, et enregistre le suivi', async () => {
  vi.mocked(recupererDemandesFormation).mockResolvedValue([DEMANDE]);
  vi.mocked(suivreDemandeFormation).mockResolvedValue({
    ...DEMANDE,
    statut: 'En_discussion',
  });
  render(<AdministrationDemandesFormationPage />);

  expect(await screen.findByText('Pâte à sucre')).toBeDefined();
  expect(screen.getByText(/Hery Rakoto — 034 12 345 67/)).toBeDefined();
  const enregistrer = screen.getByRole('button', { name: /Enregistrer le suivi/ });
  expect(enregistrer).toHaveProperty('disabled', true);

  await userEvent.selectOptions(screen.getByLabelText('Avancement'), 'En_discussion');
  await userEvent.type(screen.getByLabelText('Note interne'), 'Rappeler jeudi');
  await userEvent.click(enregistrer);

  expect(suivreDemandeFormation).toHaveBeenCalledWith(3, {
    statut: 'En_discussion',
    note_interne: 'Rappeler jeudi',
  });
});

it('compte et filtre les demandes par avancement', async () => {
  vi.mocked(recupererDemandesFormation).mockResolvedValue([
    DEMANDE,
    { ...DEMANDE, id_demande: 4, sujet: 'Pain au levain', statut: 'Refusee' },
  ]);
  render(<AdministrationDemandesFormationPage />);
  await screen.findByText('Pâte à sucre');

  const onglets = screen.getByRole('tablist', { name: 'Filtrer par avancement' });
  await userEvent.click(within(onglets).getByRole('tab', { name: /Refusée 1/ }));

  expect(screen.queryByText('Pâte à sucre')).toBeNull();
  expect(screen.getByText('Pain au levain')).toBeDefined();
});
