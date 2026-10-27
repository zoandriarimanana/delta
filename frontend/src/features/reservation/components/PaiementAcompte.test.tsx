import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';

import { initierPaiement } from '@/features/paiement/paiement.api';

import type { Reservation } from '../reservation.types';
import PaiementAcompte from './PaiementAcompte';

vi.mock('@/features/paiement/paiement.api');
vi.mock('../reservation.api');

const RESERVATION: Reservation = {
  id_reservation: 9,
  type_reservation: 'Salle',
  date_debut: '2026-11-02T08:00:00Z',
  date_fin: '2026-11-02T12:00:00Z',
  nombre_personnes: 10,
  statut: 'En_attente',
  avec_hebergement: false,
  id_client: 1,
  id_session: null,
  id_salle: 3,
  id_logement: null,
  id_reservation_hebergement: null,
  montant_total: '80000.00',
  montant_acompte: '24000.00',
  acompte_paye: false,
  acompte_avant: '2026-10-14T15:40:00Z',
};

function afficher(reservation: Reservation, ouvert = false) {
  render(
    <MemoryRouter>
      <PaiementAcompte reservation={reservation} ouvertParDefaut={ouvert} />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('annonce l’acompte, le prix et l’échéance', () => {
  afficher(RESERVATION);

  expect(screen.getByText(/Acompte à payer : 24\s?000,00 Ar/)).toBeDefined();
  expect(screen.getByText(/80\s?000,00 Ar/)).toBeDefined();
  expect(screen.getByText(/À payer avant le/)).toBeDefined();
});

it('n’affiche rien quand aucun acompte n’est attendu', () => {
  const { container } = render(
    <MemoryRouter>
      <PaiementAcompte reservation={{ ...RESERVATION, acompte_avant: null }} />
    </MemoryRouter>
  );

  expect(container.textContent).toBe('');
});

it('paie l’acompte par mobile money, cible réservation', async () => {
  vi.mocked(initierPaiement).mockResolvedValue({
    id_paiement: 4,
    montant: '24000.00',
    methode: 'Mobile_money',
    fournisseur: 'Mvola',
    statut: 'En_attente',
    reference_externe: 'SIM-1',
    date_paiement: '2026-10-13T16:00:00Z',
    id_commande: null,
    id_reservation: 9,
  });
  afficher(RESERVATION);

  await userEvent.click(screen.getByRole('button', { name: /Payer l’acompte/ }));
  await userEvent.type(screen.getByRole('textbox'), '0341234567');
  await userEvent.click(screen.getByRole('button', { name: /Payer .* avec MVola/ }));

  expect(initierPaiement).toHaveBeenCalledWith(
    { type: 'reservation', idReservation: 9 },
    expect.objectContaining({ fournisseur: 'Mvola' })
  );
});
