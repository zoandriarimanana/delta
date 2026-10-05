/**
 * Fiche d'administration d'un produit : tous les champs, la note des
 * clients, les actions — et une fiche qui reste consultable une fois archivée.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  archiverProduit,
  recupererCategoriesAdministration,
  recupererProduit,
  recupererProduitsAdministration,
} from '../produit.api';
import AdministrationProduitsPage from './AdministrationProduitsPage';
import ProduitDetailAdministrationPage from './ProduitDetailAdministrationPage';

vi.mock('../produit.api');

const CATEGORIE = { id_categorie: 1, libelle: 'Pâtisserie', supprime_le: null };
const GATEAU = {
  id_produit: 4,
  nom: 'Gâteau d’anniversaire',
  description: 'Génoise, décor au choix.',
  prix_unitaire: '25000.00',
  unite_mesure: 'pièce',
  stock_disponible: 6,
  est_personnalisable: true,
  supplement_personnalisation: '5000.00',
  est_livrable: false,
  id_categorie: 1,
  note_moyenne: null,
  nombre_avis: 0,
  supprime_le: null,
};

function afficher(chemin = '/personnel/catalogue/4') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/personnel/catalogue" element={<AdministrationProduitsPage />} />
        <Route
          path="/personnel/catalogue/:idProduit"
          element={<ProduitDetailAdministrationPage />}
        />
        <Route
          path="/personnel/categories/:idCategorie"
          element={<p>Fiche catégorie</p>}
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(recupererCategoriesAdministration).mockResolvedValue([CATEGORIE]);
  vi.mocked(recupererProduitsAdministration).mockResolvedValue([GATEAU]);
  vi.mocked(recupererProduit).mockResolvedValue({
    ...GATEAU,
    note_moyenne: '4.50',
    nombre_avis: 2,
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('ProduitDetailAdministrationPage', () => {
  it('affiche tous les champs et la note des clients', async () => {
    afficher();

    expect(
      await screen.findByRole('heading', { name: 'Gâteau d’anniversaire' })
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Pâtisserie' })).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('Retrait sur place uniquement')).toBeTruthy();
    expect(
      screen.getByText(/Personnalisable — supplément de 5000.00 Ar par pièce/)
    ).toBeTruthy();
    expect(screen.getByText('Génoise, décor au choix.')).toBeTruthy();
    await waitFor(() => expect(recupererProduit).toHaveBeenCalledWith(4));
    expect(await screen.findByText(/2 avis/)).toBeTruthy();
  });

  it('un clic sur une ligne du catalogue ouvre la fiche', async () => {
    afficher('/personnel/catalogue');

    await userEvent.click(await screen.findByText('6'));

    expect(
      await screen.findByRole('heading', { name: 'Gâteau d’anniversaire' })
    ).toBeTruthy();
  });

  it('archive depuis la fiche, qui reste consultable et propose « Restaurer »', async () => {
    vi.mocked(archiverProduit).mockResolvedValue();
    // Première lecture : actif ; après l'archivage, la relecture le dit archivé.
    vi.mocked(recupererProduitsAdministration)
      .mockResolvedValueOnce([GATEAU])
      .mockResolvedValue([{ ...GATEAU, supprime_le: '2026-10-05T09:00:00Z' }]);
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }));

    expect(archiverProduit).toHaveBeenCalledWith(4);
    expect(await screen.findByRole('button', { name: 'Restaurer' })).toBeTruthy();
    expect(screen.getByText('Non calculé pour un produit archivé')).toBeTruthy();
  });

  it('ouvre le formulaire de modification', async () => {
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }));

    expect(screen.getByRole('heading', { name: 'Modifier le produit' })).toBeTruthy();
  });

  it('un identifiant inconnu donne « Produit introuvable »', async () => {
    afficher('/personnel/catalogue/999');

    expect(await screen.findByText('Produit introuvable.')).toBeTruthy();
  });
});
