/** Tests de la fiche publique d'une salle. */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { recupererPhotos } from '@/features/galerie/galerie.api';

import { recupererSalle } from '../salle.api';
import type { Salle } from '../salle.types';
import SalleDetailPage from './SalleDetailPage';

vi.mock('../salle.api');
vi.mock('@/features/galerie/galerie.api', async (original) => ({
  ...(await original<typeof import('@/features/galerie/galerie.api')>()),
  recupererPhotos: vi.fn(),
}));
// La page monte le formulaire sans rien en savoir : il est remplacé ici.
vi.mock('@/features/reservation/components/FormulaireReservationCreneau', () => ({
  default: () => <p>Formulaire de réservation</p>,
}));

const SALLE: Salle = {
  id_salle: 3,
  nom: 'Salle Ravinala',
  capacite: 40,
  tarif_horaire: '15000.00',
  tarif_journee: null,
  equipements: 'Vidéoprojecteur, Sonorisation',
  description: 'Lumineuse.\nVue sur le jardin.',
  note_moyenne: null,
  nombre_avis: 0,
};

function afficher(chemin = '/salles/3') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/salles/:idSalle" element={<SalleDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(recupererSalle).mockResolvedValue(SALLE);
  vi.mocked(recupererPhotos).mockResolvedValue([
    { fichier: '3-1.jpg' },
    { fichier: '3-2.jpg' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('affiche la galerie de la salle', async () => {
  afficher();

  expect(
    await screen.findByRole('img', { name: 'Salle Ravinala, photo 1 sur 2' })
  ).toBeDefined();
  expect(recupererPhotos).toHaveBeenCalledWith({ salle: 3 });
  expect(screen.getByText('1 / 2')).toBeDefined();
});

it('affiche les statuts, les équipements et la description complète', async () => {
  afficher();

  const statuts = await screen.findByRole('list', { name: 'Statuts de la salle' });
  expect(statuts.textContent).toContain('Réservable');
  expect(statuts.textContent).toContain('Jusqu’à 40 personne(s)');
  expect(statuts.textContent).toContain('À l’heure');
  expect(statuts.textContent).not.toContain('À la journée');
  expect(screen.getByText('Sonorisation')).toBeDefined();
  expect(screen.getByText(/Vue sur le jardin/)).toBeDefined();
  expect(screen.getByText(/Elle se loue à l’heure/)).toBeDefined();
});

it('présente la salle même sans description rédigée', async () => {
  vi.mocked(recupererSalle).mockResolvedValue({ ...SALLE, description: null });
  afficher();

  expect(await screen.findByText(/Aucune présentation détaillée/)).toBeDefined();
});

it('monte le formulaire de réservation', async () => {
  afficher();

  expect(await screen.findByText('Formulaire de réservation')).toBeDefined();
});

it('propose le retour aux salles, même pour une salle introuvable', async () => {
  vi.mocked(recupererSalle).mockRejectedValue(new Error('404'));
  afficher();

  expect(await screen.findByRole('alert')).toBeDefined();
  expect(
    screen.getByRole('link', { name: /Retour aux salles/ }).getAttribute('href')
  ).toBe('/salles');
});
