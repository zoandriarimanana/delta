/**
 * Tests de la fiche personnel, administration.
 *
 * Le point central est propre à cette page : `GET /personnel/{id}` retombe
 * en 404 sur une ligne tout juste archivée ou anonymisée (pas de paramètre
 * `inclure_supprimes` exposé, contrairement à PRODUIT), donc la page ne doit
 * **jamais** recharger depuis le serveur juste après ces deux actions — elle
 * doit continuer à afficher sa dernière donnée locale connue. C'est
 * exactement ce que ces tests vérifient, pas seulement la description du
 * mécanisme.
 */

import { MemoryRouter, Route, Routes } from 'react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  anonymiserPersonnel,
  archiverPersonnel,
  obtenirPersonnel,
  restaurerPersonnel,
} from '../personnel.api';
import type { Personnel } from '../personnel.types';
import PersonnelDetailAdministrationPage from './PersonnelDetailAdministrationPage';

vi.mock('../personnel.api');

const RAKOTO: Personnel = {
  id_personnel: 7,
  nom: 'Rakoto',
  prenom: 'Jean',
  fonction: 'Livreur',
  email: 'jean.rakoto@delta.mg',
  telephone: '+261340000000',
  date_embauche: null,
  specialite: null,
  zone_livraison: null,
  est_administrateur: false,
};

function afficher() {
  render(
    <MemoryRouter initialEntries={['/personnel/administration/7']}>
      <Routes>
        <Route
          path="/personnel/administration/:idPersonnel"
          element={<PersonnelDetailAdministrationPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('affiche la fiche une fois chargée', async () => {
  vi.mocked(obtenirPersonnel).mockResolvedValue(RAKOTO);

  afficher();

  expect(await screen.findByRole('heading', { name: 'Jean Rakoto' })).toBeTruthy();
  expect(screen.getByText('jean.rakoto@delta.mg')).toBeTruthy();
});

describe('archivage', () => {
  it('propose Restaurer et garde le nom affiché, sans jamais recharger la fiche', async () => {
    vi.mocked(obtenirPersonnel).mockResolvedValue(RAKOTO);
    vi.mocked(archiverPersonnel).mockResolvedValue(undefined);
    afficher();
    await screen.findByRole('heading', { name: 'Jean Rakoto' });

    await userEvent.click(screen.getByRole('button', { name: /^archiver$/i }));

    expect(await screen.findByText(/ce membre a été archivé/i)).toBeTruthy();
    // Le nom reste affiché : la page n'a pas basculé sur une erreur 404.
    expect(screen.getByRole('heading', { name: 'Jean Rakoto' })).toBeTruthy();
    // Un seul appel de lecture — le succès de l'archivage n'en déclenche pas
    // un second, qui échouerait en 404.
    expect(obtenirPersonnel).toHaveBeenCalledTimes(1);
  });

  it('Restaurer relit la fiche à jour et fait disparaître l’affordance', async () => {
    vi.mocked(obtenirPersonnel).mockResolvedValue(RAKOTO);
    vi.mocked(archiverPersonnel).mockResolvedValue(undefined);
    vi.mocked(restaurerPersonnel).mockResolvedValue(RAKOTO);
    afficher();
    await screen.findByRole('heading', { name: 'Jean Rakoto' });
    await userEvent.click(screen.getByRole('button', { name: /^archiver$/i }));
    await screen.findByText(/ce membre a été archivé/i);

    await userEvent.click(screen.getByRole('button', { name: /^restaurer$/i }));

    await waitFor(() =>
      expect(screen.queryByText(/ce membre a été archivé/i)).toBeNull()
    );
    expect(restaurerPersonnel).toHaveBeenCalledWith(7);
  });
});

describe('anonymisation', () => {
  it('affiche les données anonymisées renvoyées par le serveur, sans recharger', async () => {
    vi.mocked(obtenirPersonnel).mockResolvedValue(RAKOTO);
    vi.mocked(anonymiserPersonnel).mockResolvedValue({
      ...RAKOTO,
      nom: 'Anonymisé',
      prenom: 'Anonymisé',
      email: 'supprime+7@delta.invalid',
      telephone: null,
    });
    afficher();
    await screen.findByRole('heading', { name: 'Jean Rakoto' });

    await userEvent.click(screen.getByRole('button', { name: /^anonymiser$/i }));

    expect(
      await screen.findByRole('heading', { name: 'Anonymisé Anonymisé' })
    ).toBeTruthy();
    expect(screen.getByText('supprime+7@delta.invalid')).toBeTruthy();
    expect(obtenirPersonnel).toHaveBeenCalledTimes(1);
  });

  it('masque Modifier/Archiver/Anonymiser — la ligne est désormais archivée', async () => {
    // `anonymiser()` archive la ligne côté serveur au même titre que
    // `archiver()` : proposer encore ces boutons mènerait à un 404 au clic
    // suivant (PersonnelService.obtenir filtre les lignes archivées).
    vi.mocked(obtenirPersonnel).mockResolvedValue(RAKOTO);
    vi.mocked(anonymiserPersonnel).mockResolvedValue({
      ...RAKOTO,
      nom: 'Anonymisé',
      prenom: 'Anonymisé',
      email: 'supprime+7@delta.invalid',
    });
    afficher();
    await screen.findByRole('heading', { name: 'Jean Rakoto' });

    await userEvent.click(screen.getByRole('button', { name: /^anonymiser$/i }));

    await screen.findByRole('heading', { name: 'Anonymisé Anonymisé' });
    expect(screen.queryByRole('button', { name: /^modifier$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^archiver$/i })).toBeNull();
    expect(screen.getByText(/ce membre a été archivé/i)).toBeTruthy();
  });
});

it('affiche le refus 403 tel quel sur une action réservée aux administrateurs', async () => {
  vi.mocked(obtenirPersonnel).mockResolvedValue(RAKOTO);
  vi.mocked(archiverPersonnel).mockRejectedValue({ response: { status: 403 } });
  afficher();
  await screen.findByRole('heading', { name: 'Jean Rakoto' });

  await userEvent.click(screen.getByRole('button', { name: /^archiver$/i }));

  expect((await screen.findByRole('alert')).textContent).toContain(
    'Cette action est réservée aux administrateurs.'
  );
});
