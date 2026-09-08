/**
 * Tests de la fiche commande, administration (Sprint 10.6).
 *
 * Le point central : les trois actions n'apparaissent que sous leurs
 * conditions propres — « Relancer la livraison » seulement s'il existe une
 * livraison `Echouee` pour cette commande, « Annuler » seulement hors statut
 * terminal/déjà annulée, « Marquer remboursée » toujours (décision délibérée,
 * cf. `commande_service.py::rembourser`).
 */

import { MemoryRouter, Route, Routes } from 'react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  annulerCommandeAdministration,
  obtenirCommandeAdministration,
  rembourserCommandeAdministration,
} from '../commande.api';
import type { Commande } from '../commande.types';
import CommandeDetailAdministrationPage from './CommandeDetailAdministrationPage';
import {
  recupererLivraisonsAdministration,
  relancerLivraison,
} from '@/features/livraison/livraison.api';
import type { LivraisonAdministration } from '@/features/livraison/livraison.types';

vi.mock('../commande.api');
vi.mock('@/features/livraison/livraison.api');

const COMMANDE: Commande = {
  id_commande: 7,
  date_commande: '2026-07-29T09:30:00+00:00',
  reference_publique: null,
  type_commande: 'En_ligne',
  statut: 'En_attente',
  montant_total: '7000.00',
  id_client: 3,
  nom_invite: null,
  contact_invite: null,
  lignes: [],
  rembourse_le: null,
};

const LIVRAISON_ECHOUEE: LivraisonAdministration = {
  id_livraison: 12,
  id_commande: 7,
  statut: 'Echouee',
  date_heure_prevue: null,
  date_heure_reelle: null,
  id_personnel: 4,
};

function afficher() {
  render(
    <MemoryRouter initialEntries={['/personnel/commandes/administration/7']}>
      <Routes>
        <Route
          path="/personnel/commandes/administration/:idCommande"
          element={<CommandeDetailAdministrationPage />}
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
  vi.mocked(obtenirCommandeAdministration).mockResolvedValue(COMMANDE);
  vi.mocked(recupererLivraisonsAdministration).mockResolvedValue([]);

  afficher();

  expect(await screen.findByRole('heading', { name: 'Commande n° 7' })).toBeTruthy();
});

describe('visibilité des actions', () => {
  it('propose Annuler et Marquer remboursée, mais pas Relancer sans livraison échouée', async () => {
    vi.mocked(obtenirCommandeAdministration).mockResolvedValue(COMMANDE);
    vi.mocked(recupererLivraisonsAdministration).mockResolvedValue([]);
    afficher();

    await screen.findByRole('heading', { name: 'Commande n° 7' });
    expect(screen.getByRole('button', { name: /^annuler$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /marquer remboursée/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /relancer la livraison/i })).toBeNull();
  });

  it('propose Relancer la livraison quand une livraison Echouee existe', async () => {
    vi.mocked(obtenirCommandeAdministration).mockResolvedValue(COMMANDE);
    vi.mocked(recupererLivraisonsAdministration).mockResolvedValue([LIVRAISON_ECHOUEE]);
    afficher();

    expect(
      await screen.findByRole('button', { name: /relancer la livraison/i })
    ).toBeTruthy();
  });

  it('ne propose plus Annuler sur une commande déjà à son statut terminal', async () => {
    vi.mocked(obtenirCommandeAdministration).mockResolvedValue({
      ...COMMANDE,
      type_commande: 'Sur_place',
      statut: 'Servie',
    });
    vi.mocked(recupererLivraisonsAdministration).mockResolvedValue([]);
    afficher();

    await screen.findByRole('heading', { name: 'Commande n° 7' });
    expect(screen.queryByRole('button', { name: /^annuler$/i })).toBeNull();
    // Toujours proposée : rembourser une commande jamais payée reste un
    // geste administratif valide, pas une garde oubliée.
    expect(screen.getByRole('button', { name: /marquer remboursée/i })).toBeTruthy();
  });
});

it('clique « Annuler » appelle l’API puis recharge la fiche', async () => {
  vi.mocked(obtenirCommandeAdministration)
    .mockResolvedValueOnce(COMMANDE)
    .mockResolvedValueOnce({ ...COMMANDE, statut: 'Annulee' });
  vi.mocked(recupererLivraisonsAdministration).mockResolvedValue([]);
  vi.mocked(annulerCommandeAdministration).mockResolvedValue({
    ...COMMANDE,
    statut: 'Annulee',
  });
  afficher();
  await screen.findByRole('button', { name: /^annuler$/i });

  await userEvent.click(screen.getByRole('button', { name: /^annuler$/i }));

  await waitFor(() => expect(annulerCommandeAdministration).toHaveBeenCalledWith(7));
  await waitFor(() => expect(obtenirCommandeAdministration).toHaveBeenCalledTimes(2));
});

it('clique « Marquer remboursée » appelle l’API et affiche l’horodatage', async () => {
  vi.mocked(obtenirCommandeAdministration)
    .mockResolvedValueOnce(COMMANDE)
    .mockResolvedValueOnce({
      ...COMMANDE,
      rembourse_le: '2026-09-08T10:00:00+00:00',
    });
  vi.mocked(recupererLivraisonsAdministration).mockResolvedValue([]);
  vi.mocked(rembourserCommandeAdministration).mockResolvedValue({
    ...COMMANDE,
    rembourse_le: '2026-09-08T10:00:00+00:00',
  });
  afficher();
  await screen.findByRole('button', { name: /marquer remboursée/i });

  await userEvent.click(screen.getByRole('button', { name: /marquer remboursée/i }));

  expect(await screen.findByText(/remboursée le/i)).toBeTruthy();
  expect(rembourserCommandeAdministration).toHaveBeenCalledWith(7);
});

it('clique « Relancer la livraison » appelle l’API et fait disparaître le bouton', async () => {
  vi.mocked(obtenirCommandeAdministration).mockResolvedValue(COMMANDE);
  vi.mocked(recupererLivraisonsAdministration)
    .mockResolvedValueOnce([LIVRAISON_ECHOUEE])
    .mockResolvedValueOnce([]);
  vi.mocked(relancerLivraison).mockResolvedValue({
    ...LIVRAISON_ECHOUEE,
    statut: 'En_attente',
    id_personnel: null,
  });
  afficher();
  await screen.findByRole('button', { name: /relancer la livraison/i });

  await userEvent.click(screen.getByRole('button', { name: /relancer la livraison/i }));

  expect(relancerLivraison).toHaveBeenCalledWith(12);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /relancer la livraison/i })).toBeNull()
  );
});

it('reprend le refus 409 tel quel', async () => {
  vi.mocked(obtenirCommandeAdministration).mockResolvedValue(COMMANDE);
  vi.mocked(recupererLivraisonsAdministration).mockResolvedValue([]);
  vi.mocked(annulerCommandeAdministration).mockRejectedValue({
    response: {
      status: 409,
      data: { detail: 'Cette commande est déjà annulée.' },
    },
  });
  afficher();
  await screen.findByRole('button', { name: /^annuler$/i });

  await userEvent.click(screen.getByRole('button', { name: /^annuler$/i }));

  expect((await screen.findByRole('alert')).textContent).toContain(
    'Cette commande est déjà annulée.'
  );
});
