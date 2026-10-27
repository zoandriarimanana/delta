/** Tests de la fiche publique d'une formation. */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { recupererPhotos } from '@/features/galerie/galerie.api';

import {
  recupererDomaines,
  recupererFormation,
  recupererSessions,
} from '../formation.api';
import type { Formation, SessionFormation } from '../formation.types';
import FormationDetailPage from './FormationDetailPage';

vi.mock('../formation.api');
vi.mock('@/features/galerie/galerie.api', async (original) => ({
  ...(await original<typeof import('@/features/galerie/galerie.api')>()),
  recupererPhotos: vi.fn(),
}));
// La page monte le formulaire sans rien en savoir : il est remplacé ici.
vi.mock('@/features/reservation/components/FormulaireReservation', () => ({
  default: () => <p>Formulaire de réservation</p>,
}));

const FORMATION: Formation = {
  id_formation: 4,
  titre: 'Masterclass pâtisserie',
  niveau: 'Avancé',
  duree_heures: 21,
  prix: '150000.00',
  capacite_max: 8,
  propose_hebergement: true,
  id_domaine: 1,
  description: 'Trois jours d’atelier.\nMatériel fourni.',
  note_moyenne: null,
  nombre_avis: 0,
};

function session(surcharge: Partial<SessionFormation> = {}): SessionFormation {
  return {
    id_session: 1,
    date_debut: '2026-11-02',
    date_fin: '2026-11-04',
    places_restantes: 3,
    statut: 'Ouverte',
    id_formation: 4,
    formateur: null,
    ...surcharge,
  } as SessionFormation;
}

function afficher() {
  return render(
    <MemoryRouter initialEntries={['/formations/4']}>
      <Routes>
        <Route path="/formations/:idFormation" element={<FormationDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(recupererFormation).mockResolvedValue(FORMATION);
  vi.mocked(recupererSessions).mockResolvedValue([
    session(),
    session({ id_session: 2, statut: 'Planifiee' }),
  ]);
  vi.mocked(recupererDomaines).mockResolvedValue([
    { id_domaine: 1, libelle: 'Pâtisserie', description: 'Les classiques français.' },
  ]);
  vi.mocked(recupererPhotos).mockResolvedValue([{ fichier: '4-1.jpg' }]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('affiche la galerie, le domaine et la description complète', async () => {
  afficher();

  expect(
    await screen.findByRole('img', { name: 'Masterclass pâtisserie, photo 1 sur 1' })
  ).toBeDefined();
  expect(recupererPhotos).toHaveBeenCalledWith({ formation: 4 });
  expect(await screen.findByText('Pâtisserie')).toBeDefined();
  expect(screen.getByText(/Matériel fourni/)).toBeDefined();
  expect(screen.getByText(/Les classiques français/)).toBeDefined();
});

it('résume les statuts de la formation', async () => {
  afficher();

  const statuts = await screen.findByRole('list', { name: 'Statuts de la formation' });
  expect(statuts.textContent).toContain('1 session(s) ouverte(s)');
  expect(statuts.textContent).toContain('Niveau Avancé');
  expect(statuts.textContent).toContain('Hébergement possible');
});

it('explique l’état de chaque session et ne propose le formulaire que si elle est ouverte', async () => {
  afficher();

  expect(await screen.findByText('Inscriptions ouvertes')).toBeDefined();
  expect(screen.getByText('Bientôt ouverte')).toBeDefined();
  expect(screen.getByText(/pas encore ouvertes/)).toBeDefined();
  expect(screen.getAllByText('Formulaire de réservation')).toHaveLength(1);
});

it('annonce l’absence de session plutôt qu’une liste vide', async () => {
  vi.mocked(recupererSessions).mockResolvedValue([]);
  afficher();

  expect(await screen.findByText(/Aucune session n’est programmée/)).toBeDefined();
});

it('présente la formation même sans description rédigée', async () => {
  vi.mocked(recupererFormation).mockResolvedValue({ ...FORMATION, description: null });
  afficher();

  expect(await screen.findByText(/Aucune présentation détaillée/)).toBeDefined();
});
