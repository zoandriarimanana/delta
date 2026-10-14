import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { recupererCouvertures } from '@/features/galerie/galerie.api';

import { recupererTableauDeBord } from '../tableauDeBord.api';
import type { TableauDeBord } from '../tableauDeBord.types';
import TableauDeBordPage from './TableauDeBordPage';

vi.mock('../tableauDeBord.api');
vi.mock('@/features/galerie/galerie.api', async (original) => ({
  ...(await original<typeof import('@/features/galerie/galerie.api')>()),
  recupererCouvertures: vi.fn(),
}));

const DONNEES: TableauDeBord = {
  periode: '30j',
  chiffre_affaires: '125000.00',
  nombre_commandes: 5,
  panier_moyen: '25000.00',
  commandes_a_confirmer: 2,
  produits: [
    {
      id_produit: 1,
      nom: 'Éclair',
      unites_vendues: 12,
      chiffre_affaires: '42000.00',
      nombre_commandes: 4,
    },
    {
      id_produit: 2,
      nom: 'Gâteau',
      unites_vendues: 2,
      chiffre_affaires: '60000.00',
      nombre_commandes: 2,
    },
  ],
};

beforeEach(() => {
  vi.mocked(recupererTableauDeBord).mockResolvedValue(DONNEES);
  vi.mocked(recupererCouvertures).mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function afficher() {
  return render(
    <MemoryRouter>
      <TableauDeBordPage />
    </MemoryRouter>
  );
}

it('affiche les chiffres clés de la période', async () => {
  afficher();

  expect(await screen.findByText(/^125\s?000,00 Ar$/)).toBeDefined();
  expect(screen.getByText(/^25\s?000,00 Ar$/)).toBeDefined();
  expect(recupererTableauDeBord).toHaveBeenCalledWith('30j');
});

it('classe par quantité, puis par chiffre d’affaires à la demande', async () => {
  afficher();
  const liste = await screen.findByRole('list');
  const noms = () =>
    within(liste)
      .getAllByRole('link')
      .map((l) => l.textContent);

  expect(noms()).toEqual(['Éclair', 'Gâteau']);
  await userEvent.click(screen.getByRole('button', { name: 'Chiffre d’affaires' }));
  expect(noms()).toEqual(['Gâteau', 'Éclair']);
});

it('recharge pour une autre période', async () => {
  afficher();
  await screen.findByRole('list');

  await userEvent.click(screen.getByRole('button', { name: '7 jours' }));

  expect(recupererTableauDeBord).toHaveBeenLastCalledWith('7j');
});
