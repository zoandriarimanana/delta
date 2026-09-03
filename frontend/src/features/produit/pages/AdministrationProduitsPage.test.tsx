/**
 * Tests de l'écran d'administration du catalogue.
 *
 * Quatre garanties, dont aucune ne repose sur le masquage d'un lien :
 *
 * - un **jeton client** n'ouvre pas l'écran ;
 * - les **archives** sont affichables et **restaurables** — c'est ce que #87 et
 *   #89 ont rendu possible ;
 * - le vocabulaire dit **« archiver »**, jamais « supprimer » ;
 * - le **403** d'un salarié sans droit est rendu lisible.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RoutePersonnel from '@/lib/RoutePersonnel';
import { effacerJeton, enregistrerSession } from '@/lib/tokenStorage';

import {
  archiverProduit,
  recupererCategoriesAdministration,
  recupererProduitsAdministration,
  restaurerProduit,
} from '../produit.api';
import AdministrationProduitsPage from './AdministrationProduitsPage';

vi.mock('../produit.api');

const CATEGORIE = { id_categorie: 1, libelle: 'Pâtisserie', supprime_le: null };

const ACTIF = {
  id_produit: 1,
  nom: 'Éclair',
  description: null,
  prix_unitaire: '3.50',
  unite_mesure: 'piece',
  stock_disponible: 10,
  est_personnalisable: false,
  supplement_personnalisation: null,
  est_livrable: true,
  id_categorie: 1,
  supprime_le: null,
};

const ARCHIVE = {
  ...ACTIF,
  id_produit: 2,
  nom: 'Madeleine',
  supprime_le: '2026-09-03T08:12:44Z',
};

function afficherSousGarde() {
  return render(
    <MemoryRouter initialEntries={['/personnel/catalogue']}>
      <Routes>
        <Route
          path="/personnel/catalogue"
          element={
            <RoutePersonnel>
              <AdministrationProduitsPage />
            </RoutePersonnel>
          }
        />
        <Route path="/personnel/connexion" element={<p>connexion personnel</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function afficher() {
  return render(
    <MemoryRouter>
      <AdministrationProduitsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  effacerJeton();
  vi.mocked(recupererProduitsAdministration).mockResolvedValue([ACTIF, ARCHIVE]);
  vi.mocked(recupererCategoriesAdministration).mockResolvedValue([CATEGORIE]);
  vi.mocked(archiverProduit).mockResolvedValue(undefined);
  vi.mocked(restaurerProduit).mockResolvedValue(ACTIF);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerJeton();
});

describe('accès', () => {
  it('refuse un jeton client', () => {
    enregistrerSession('jeton', 'client');

    afficherSousGarde();

    expect(screen.getByText('connexion personnel')).toBeDefined();
    expect(recupererProduitsAdministration).not.toHaveBeenCalled();
  });

  it('refuse un visiteur non connecté', () => {
    afficherSousGarde();

    expect(screen.getByText('connexion personnel')).toBeDefined();
  });

  it('ouvre l’écran pour un salarié', () => {
    // Contrôle positif : sans lui, une garde refusant tout passerait les deux
    // tests ci-dessus.
    enregistrerSession('jeton', 'personnel');

    afficherSousGarde();

    expect(
      screen.getByRole('heading', { name: /administration du catalogue/i })
    ).toBeDefined();
  });
});

describe('archives', () => {
  beforeEach(() => enregistrerSession('jeton', 'personnel'));

  it('les masque par défaut', async () => {
    // Elles ne font pas partie du travail courant : les afficher toujours
    // noierait le catalogue actif.
    afficher();

    expect(await screen.findByText('Éclair')).toBeDefined();
    expect(screen.queryByText('Madeleine')).toBeNull();
  });

  it('les affiche à la demande, et compte combien il y en a', async () => {
    afficher();
    await screen.findByText('Éclair');

    await userEvent.click(screen.getByLabelText(/afficher les archives \(1\)/i));

    expect(screen.getByText('Madeleine')).toBeDefined();
  });

  it('propose « Restaurer » sur une archive, jamais « Archiver »', async () => {
    afficher();
    await screen.findByText('Éclair');
    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    const ligne = screen.getByText('Madeleine').closest('tr');

    expect(ligne?.textContent).toContain('Restaurer');
    expect(ligne?.textContent).not.toContain('Archiver');
  });

  it('restaure depuis la liste', async () => {
    // **Le point de #87 et #89 réunis** : sans la liste d'administration,
    // l'archive était invisible ; sans l'endpoint, elle était irrécupérable.
    afficher();
    await screen.findByText('Éclair');
    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    await userEvent.click(screen.getByRole('button', { name: /restaurer/i }));

    await waitFor(() => expect(restaurerProduit).toHaveBeenCalledWith(2));
  });
});

describe('vocabulaire', () => {
  beforeEach(() => enregistrerSession('jeton', 'personnel'));

  it('dit « archiver », jamais « supprimer »', async () => {
    // `DELETE` pose `supprime_le` : la ligne reste en base, et
    // `supprimer_definitivement` n'est exposé nulle part. Promettre un
    // effacement serait un mensonge d'interface.
    const { container } = afficher();
    await screen.findByText('Éclair');

    expect(screen.getByRole('button', { name: /archiver/i })).toBeDefined();
    expect(container.textContent?.toLowerCase()).not.toContain('supprimer');
  });

  it('archive le produit choisi', async () => {
    afficher();
    await screen.findByText('Éclair');

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    await waitFor(() => expect(archiverProduit).toHaveBeenCalledWith(1));
  });
});

describe('refus du serveur', () => {
  beforeEach(() => enregistrerSession('jeton', 'personnel'));

  it('rend le 403 lisible', async () => {
    // Un salarié sans droit voit l'écran — `est_administrateur` n'est lisible
    // nulle part côté client — et doit comprendre qu'il lui manque un droit.
    vi.mocked(archiverProduit).mockRejectedValue({ response: { status: 403 } });
    afficher();
    await screen.findByText('Éclair');

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/administrateur/i);
  });

  it('reprend le message du 409 tel quel', async () => {
    vi.mocked(restaurerProduit).mockRejectedValue({
      response: { status: 409, data: { detail: 'Refus explicite du serveur.' } },
    });
    afficher();
    await screen.findByText('Éclair');
    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    await userEvent.click(screen.getByRole('button', { name: /restaurer/i }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Refus explicite du serveur.'
    );
  });
});
