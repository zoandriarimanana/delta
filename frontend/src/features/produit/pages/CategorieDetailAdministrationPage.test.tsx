/** Fiche d'administration d'une catégorie : ses produits, ses actions. */

import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  archiverCategorie,
  modifierCategorie,
  recupererCategoriesAdministration,
  recupererProduitsAdministration,
} from '../produit.api';
import AdministrationCategoriesPage from './AdministrationCategoriesPage';
import CategorieDetailAdministrationPage from './CategorieDetailAdministrationPage';

vi.mock('../produit.api');

const CATEGORIE = { id_categorie: 1, libelle: 'Pâtisserie', supprime_le: null };
const PRODUIT = {
  id_produit: 4,
  nom: 'Éclair',
  description: null,
  prix_unitaire: '3.50',
  unite_mesure: 'pièce',
  stock_disponible: 10,
  est_personnalisable: false,
  supplement_personnalisation: null,
  est_livrable: true,
  id_categorie: 1,
  note_moyenne: null,
  nombre_avis: 0,
  supprime_le: null,
};

function afficher(chemin = '/personnel/categories/1') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route
          path="/personnel/categories"
          element={<AdministrationCategoriesPage />}
        />
        <Route
          path="/personnel/categories/:idCategorie"
          element={<CategorieDetailAdministrationPage />}
        />
        <Route path="/personnel/catalogue/:idProduit" element={<p>Fiche produit</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(recupererCategoriesAdministration).mockResolvedValue([CATEGORIE]);
  vi.mocked(recupererProduitsAdministration).mockResolvedValue([
    PRODUIT,
    {
      ...PRODUIT,
      id_produit: 5,
      nom: 'Madeleine',
      supprime_le: '2026-09-01T00:00:00Z',
    },
    { ...PRODUIT, id_produit: 6, nom: 'Baguette', id_categorie: 2 },
  ]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('CategorieDetailAdministrationPage', () => {
  it('liste ses seuls produits, actifs et archivés', async () => {
    afficher();

    expect(
      await screen.findByText(/2 produit\(s\) dans cette catégorie, dont 1 actif/)
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Éclair' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Madeleine' })).toBeTruthy();
    expect(screen.queryByText('Baguette')).toBeNull();
  });

  it('un produit mène à sa fiche', async () => {
    afficher();

    await userEvent.click((await screen.findAllByText('10'))[0]!);

    expect(await screen.findByText('Fiche produit')).toBeTruthy();
  });

  it('un clic sur une catégorie de la liste ouvre sa fiche', async () => {
    afficher('/personnel/categories');

    await userEvent.click(await screen.findByRole('link', { name: 'Pâtisserie' }));

    expect(await screen.findByText(/produit\(s\) dans cette catégorie/)).toBeTruthy();
  });

  it('renomme depuis la fiche', async () => {
    vi.mocked(modifierCategorie).mockResolvedValue(CATEGORIE);
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: 'Renommer' }));
    const champ = screen.getByLabelText('Libellé');
    await userEvent.clear(champ);
    await userEvent.type(champ, 'Pâtisserie fine');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(modifierCategorie).toHaveBeenCalledWith(1, { libelle: 'Pâtisserie fine' });
  });

  it('reprend tel quel le refus d’archivage', async () => {
    vi.mocked(archiverCategorie).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Cette catégorie contient encore des produits.' },
      },
    });
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }));

    expect(
      await screen.findByText('Cette catégorie contient encore des produits.')
    ).toBeTruthy();
  });
});
