/**
 * Écrans client en anglais : textes, statuts et dates dans la langue choisie.
 *
 * Un seul écran suffit à verrouiller la chaîne complète — textes du module,
 * libellés calculés hors composant (statut, mode de réception) et dates dans
 * la locale — que tous les modules partagent.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { recupererSuivi } from '@/features/livraison/livraison.api';
import { definirLangue } from '@/lib/langue';
import { definirSession, effacerSession } from '@/lib/session.store';

import { recupererHistorique } from '../commande.api';
import type { Commande } from '../commande.types';
import HistoriqueCommandesPage from './HistoriqueCommandesPage';

vi.mock('../commande.api');
vi.mock('@/features/livraison/livraison.api');

const COMMANDE: Commande = {
  id_commande: 16,
  date_commande: '2026-10-08T10:47:00+00:00',
  reference_publique: null,
  type_commande: 'A_emporter',
  statut: 'En_attente',
  montant_total: '20000.00',
  frais_livraison: '0.00',
  id_client: 1,
  nom_invite: null,
  contact_invite: null,
  lignes: [],
  rembourse_le: null,
  devise: 'USD',
  taux_change: '4500.0000',
  montant_total_devise: '4.44',
};

beforeEach(() => {
  definirSession('client');
  vi.mocked(recupererHistorique).mockResolvedValue([COMMANDE]);
  // Commande à retirer : aucun suivi de livraison (404 côté serveur).
  vi.mocked(recupererSuivi).mockRejectedValue({ response: { status: 404 } });
});

afterEach(() => {
  cleanup();
  act(() => definirLangue('fr'));
  effacerSession();
  vi.resetAllMocks();
});

it('affiche « Mes commandes » entièrement en anglais', async () => {
  act(() => definirLangue('en'));
  render(
    <MemoryRouter>
      <HistoriqueCommandesPage />
    </MemoryRouter>
  );

  expect(await screen.findByText('Order no. 16')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'My orders' })).toBeTruthy();
  expect(screen.getByText('Awaiting confirmation')).toBeTruthy();
  expect(screen.getByText(/In-store pickup/)).toBeTruthy();
  // Date en anglais ; l'heure dépend du fuseau de la machine, elle n'est pas figée.
  expect(screen.getByText(/October 8, 2026/)).toBeTruthy();
  expect(screen.getAllByText('$4.44').length).toBeGreaterThan(0);
});
