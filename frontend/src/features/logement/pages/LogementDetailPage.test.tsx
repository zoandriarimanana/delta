/** Tests de la fiche publique d'un logement. */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { recupererPhotos } from '@/features/galerie/galerie.api';

import { recupererLogement } from '../logement.api';
import type { Logement } from '../logement.types';
import LogementDetailPage from './LogementDetailPage';

vi.mock('../logement.api');
vi.mock('@/features/galerie/galerie.api', async (original) => ({
  ...(await original<typeof import('@/features/galerie/galerie.api')>()),
  recupererPhotos: vi.fn(),
}));
vi.mock('@/features/reservation/components/FormulaireReservationCreneau', () => ({
  default: ({ reservable }: { reservable?: boolean }) => (
    <p>{reservable === false ? 'Réservation fermée' : 'Réservation ouverte'}</p>
  ),
}));

const LOGEMENT: Logement = {
  id_logement: 5,
  type_chambre: 'Double',
  capacite: 2,
  tarif_nuitee: '80000.00',
  statut: 'Disponible',
  description: 'Salle d’eau privée.',
  note_moyenne: null,
  nombre_avis: 0,
};

function afficher() {
  return render(
    <MemoryRouter initialEntries={['/logements/5']}>
      <Routes>
        <Route path="/logements/:idLogement" element={<LogementDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(recupererLogement).mockResolvedValue(LOGEMENT);
  vi.mocked(recupererPhotos).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('affiche le statut et son explication détaillée', async () => {
  afficher();

  expect(await screen.findByText('Statut : Disponible à la réservation')).toBeDefined();
  expect(screen.getByText(/ouvert à la réservation/)).toBeDefined();
  expect(screen.getByText('Réservation ouverte')).toBeDefined();
  expect(screen.getByText('Salle d’eau privée.')).toBeDefined();
});

it('explique un logement en maintenance et ferme la réservation', async () => {
  vi.mocked(recupererLogement).mockResolvedValue({
    ...LOGEMENT,
    statut: 'En_maintenance',
  });
  afficher();

  expect(await screen.findByText(/reviendra dans l’offre/)).toBeDefined();
  expect(screen.getByText('Réservation fermée')).toBeDefined();
});

it('affiche une illustration quand le logement n’a aucune photo', async () => {
  const { container } = afficher();

  await screen.findByRole('heading', { name: 'Chambre Double' });
  expect(recupererPhotos).toHaveBeenCalledWith({ logement: 5 });
  expect(container.querySelector('img')?.getAttribute('src')).toContain('w=900');
});
