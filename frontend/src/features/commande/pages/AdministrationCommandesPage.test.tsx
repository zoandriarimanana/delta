/**
 * Tests de la page liste d'administration des commandes.
 *
 * Deux points portent l'essentiel : le filtre par statut, côté client
 * (`GET /commandes/administration` ne porte aucun paramètre de filtre) —
 * et la présence des liens vers les écrans « Abonnements »/« Réservations »
 * déjà livrés, plutôt qu'une page agrégée.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recupererCommandesAdministration } from '../commande.api';
import type { Commande } from '../commande.types';
import AdministrationCommandesPage from './AdministrationCommandesPage';

vi.mock('../commande.api');

function commande(surcharge: Partial<Commande> = {}): Commande {
  return {
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
    ...surcharge,
  };
}

const EN_ATTENTE = commande({ id_commande: 1, statut: 'En_attente' });
const ANNULEE = commande({ id_commande: 2, statut: 'Annulee' });

function afficher() {
  return render(
    <MemoryRouter>
      <AdministrationCommandesPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('affiche toutes les commandes une fois chargées', async () => {
  vi.mocked(recupererCommandesAdministration).mockResolvedValue([EN_ATTENTE, ANNULEE]);

  afficher();

  const tableau = await screen.findByRole('table');
  expect(within(tableau).getByText('Commande n° 1')).toBeTruthy();
  expect(within(tableau).getByText('Commande n° 2')).toBeTruthy();
});

it('filtre par statut, côté client', async () => {
  vi.mocked(recupererCommandesAdministration).mockResolvedValue([EN_ATTENTE, ANNULEE]);
  afficher();
  const tableau = await screen.findByRole('table');
  expect(within(tableau).getByText('Commande n° 2')).toBeTruthy();

  await userEvent.selectOptions(screen.getByLabelText(/^statut$/i), 'Annulee');

  expect(within(tableau).queryByText('Commande n° 1')).toBeNull();
  expect(within(tableau).getByText('Commande n° 2')).toBeTruthy();
});

describe('liens vers les écrans existants', () => {
  it('propose des liens vers Abonnements et Réservations, pas une page agrégée', async () => {
    vi.mocked(recupererCommandesAdministration).mockResolvedValue([]);
    afficher();
    await screen.findByText(/aucune commande/i);

    const lienAbonnements = screen.getByRole('link', { name: /abonnements/i });
    const lienReservations = screen.getByRole('link', { name: /réservations/i });

    expect(lienAbonnements.getAttribute('href')).toBe('/personnel/abonnements');
    expect(lienReservations.getAttribute('href')).toBe('/personnel/reservations');
  });
});
