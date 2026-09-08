/**
 * Tests de l'écran des catégories.
 *
 * Ce qui le distingue de l'écran produit : **la restauration peut échouer**.
 * L'index unique sur le libellé est partiel, donc le nom a pu être repris
 * pendant l'archivage — le serveur répond alors 409, et l'écran doit le dire.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { effacerJeton, enregistrerSession } from '@/lib/tokenStorage';

import {
  archiverCategorie,
  creerCategorie,
  recupererCategoriesAdministration,
  recupererProduitsAdministration,
  restaurerCategorie,
} from '../produit.api';
import AdministrationCategoriesPage from './AdministrationCategoriesPage';

vi.mock('../produit.api');

const ACTIVE = { id_categorie: 1, libelle: 'Pâtisserie', supprime_le: null };
const ARCHIVEE = {
  id_categorie: 2,
  libelle: 'Confiserie',
  supprime_le: '2026-09-03T08:12:44Z',
};

function afficher() {
  return render(
    <MemoryRouter>
      <AdministrationCategoriesPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  enregistrerSession('jeton', 'personnel');
  vi.mocked(recupererCategoriesAdministration).mockResolvedValue([ACTIVE, ARCHIVEE]);
  vi.mocked(recupererProduitsAdministration).mockResolvedValue([]);
  vi.mocked(creerCategorie).mockResolvedValue(ACTIVE);
  vi.mocked(archiverCategorie).mockResolvedValue(undefined);
  vi.mocked(restaurerCategorie).mockResolvedValue(ACTIVE);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  effacerJeton();
});

describe('liste', () => {
  it('masque les archives par défaut et les compte', async () => {
    afficher();

    expect(await screen.findByText('Pâtisserie')).toBeDefined();
    expect(screen.queryByText('Confiserie')).toBeNull();
    expect(screen.getByLabelText(/afficher les archives \(1\)/i)).toBeDefined();
  });

  it('les affiche à la demande', async () => {
    afficher();
    await screen.findByText('Pâtisserie');

    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    expect(screen.getByText('Confiserie')).toBeDefined();
  });

  it('dit « archiver », jamais « supprimer »', async () => {
    const { container } = afficher();
    await screen.findByText('Pâtisserie');

    expect(screen.getByRole('button', { name: /archiver/i })).toBeDefined();
    expect(container.textContent?.toLowerCase()).not.toContain('supprimer');
  });
});

describe('écritures', () => {
  it('crée une catégorie', async () => {
    afficher();
    await screen.findByText('Pâtisserie');

    await userEvent.type(screen.getByLabelText(/libellé/i), 'Boulangerie');
    await userEvent.click(screen.getByRole('button', { name: /ajouter/i }));

    await waitFor(() =>
      expect(creerCategorie).toHaveBeenCalledWith({ libelle: 'Boulangerie' })
    );
  });

  it('restaure une archivée depuis la liste', async () => {
    afficher();
    await screen.findByText('Pâtisserie');
    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    await userEvent.click(screen.getByRole('button', { name: /restaurer/i }));

    await waitFor(() => expect(restaurerCategorie).toHaveBeenCalledWith(2));
  });
});

describe('refus', () => {
  it('reprend tel quel le 409 d’archivage d’une catégorie peuplée', async () => {
    // « Cette catégorie contient encore des produits » dit quoi corriger :
    // archiver les produits d'abord, ou les déplacer.
    vi.mocked(archiverCategorie).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Cette catégorie contient encore des produits.' },
      },
    });
    afficher();
    await screen.findByText('Pâtisserie');

    await userEvent.click(screen.getByRole('button', { name: /archiver/i }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Cette catégorie contient encore des produits.'
    );
  });

  it('reprend tel quel le 409 de restauration sur collision', async () => {
    // **Le cas que le produit ne connaît pas.** L'index étant partiel, le
    // libellé a pu être repris : le message dit de renommer l'autre, ou de
    // renoncer.
    vi.mocked(restaurerCategorie).mockRejectedValue({
      response: {
        status: 409,
        data: {
          detail:
            'Une catégorie active porte déjà ce libellé, restauration impossible.',
        },
      },
    });
    afficher();
    await screen.findByText('Pâtisserie');
    await userEvent.click(screen.getByLabelText(/afficher les archives/i));

    await userEvent.click(screen.getByRole('button', { name: /restaurer/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /restauration impossible/
    );
  });

  it('rend le 403 lisible', async () => {
    vi.mocked(creerCategorie).mockRejectedValue({ response: { status: 403 } });
    afficher();
    await screen.findByText('Pâtisserie');

    await userEvent.type(screen.getByLabelText(/libellé/i), 'X');
    await userEvent.click(screen.getByRole('button', { name: /ajouter/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/administrateur/i);
  });
});
