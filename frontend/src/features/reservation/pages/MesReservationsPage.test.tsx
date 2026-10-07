/** Tests de « Mes réservations » : rubriques, noms, annulation, avis. */

import { act, cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { recupererLogements } from '@/features/logement/logement.api';
import { recupererSalles } from '@/features/salle/salle.api';
import { definirSession, effacerSession } from '@/lib/session.store';

import { annulerReservation, recupererReservations } from '../reservation.api';
import type { Reservation } from '../reservation.types';
import MesReservationsPage from './MesReservationsPage';

vi.mock('../reservation.api');
vi.mock('@/features/salle/salle.api');
vi.mock('@/features/logement/logement.api');
vi.mock('@/features/formation/formation.api');

const LOIN = new Date(Date.now() + 30 * 86_400_000).toISOString();
const LOIN_FIN = new Date(Date.now() + 31 * 86_400_000).toISOString();

function reservation(partiel: Partial<Reservation>): Reservation {
  return {
    id_reservation: 1,
    type_reservation: 'Salle',
    date_debut: LOIN,
    date_fin: LOIN_FIN,
    nombre_personnes: 20,
    statut: 'Confirmee',
    avec_hebergement: false,
    id_client: 1,
    id_session: null,
    id_salle: 3,
    id_logement: null,
    id_reservation_hebergement: null,
    ...partiel,
  };
}

const RESERVATIONS: Reservation[] = [
  reservation({ id_reservation: 10 }),
  reservation({
    id_reservation: 7,
    type_reservation: 'Logement',
    id_salle: null,
    id_logement: 1,
    statut: 'Annulee',
  }),
  reservation({
    id_reservation: 6,
    type_reservation: 'Table',
    id_salle: null,
    statut: 'Honoree',
    date_debut: '2026-09-06T10:39:00Z',
    date_fin: '2026-09-06T12:39:00Z',
  }),
];

function afficher() {
  return render(
    <MemoryRouter>
      <MesReservationsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  act(() => definirSession('client'));
  vi.mocked(recupererReservations).mockResolvedValue(RESERVATIONS);
  vi.mocked(recupererSalles).mockResolvedValue([
    {
      id_salle: 3,
      nom: 'Grande salle événements',
      capacite: 200,
      tarif_horaire: null,
      tarif_journee: '2000.00',
      equipements: null,
      description: null,
      note_moyenne: null,
      nombre_avis: 0,
    },
  ]);
  vi.mocked(recupererLogements).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  act(() => effacerSession());
  vi.resetAllMocks();
});

it('range les réservations en onglets, avec leur nombre', async () => {
  afficher();

  const onglets = await screen.findByRole('tablist', {
    name: 'Rubriques de réservations',
  });
  expect(within(onglets).getByRole('tab', { name: /À venir\s*1/ })).toHaveProperty(
    'ariaSelected',
    'true'
  );
  expect(within(onglets).getByRole('tab', { name: /Passées\s*1/ })).toBeDefined();
  expect(within(onglets).getByRole('tab', { name: /Annulées\s*1/ })).toBeDefined();
});

it('affiche le vrai nom de la salle, lié à sa fiche', async () => {
  afficher();

  const lien = await screen.findByRole('link', { name: 'Grande salle événements' });
  expect(lien.getAttribute('href')).toBe('/salles/3');
  expect(screen.queryByText('Salle n° 3')).toBeNull();
});

it('annule après confirmation, puis recharge', async () => {
  vi.mocked(annulerReservation).mockResolvedValue(
    reservation({ id_reservation: 10, statut: 'Annulee' })
  );
  afficher();

  await userEvent.click(
    await screen.findByRole('button', { name: /Annuler la réservation/ })
  );
  expect(annulerReservation).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /Confirmer l’annulation/ }));

  expect(annulerReservation).toHaveBeenCalledWith(10);
  expect(recupererReservations).toHaveBeenCalledTimes(2);
});

it('reprend le refus du serveur sans perdre la carte', async () => {
  vi.mocked(annulerReservation).mockRejectedValue({
    response: { data: { detail: 'Cette réservation est déjà annulée.' } },
  });
  afficher();

  await userEvent.click(
    await screen.findByRole('button', { name: /Annuler la réservation/ })
  );
  await userEvent.click(screen.getByRole('button', { name: /Confirmer l’annulation/ }));

  expect((await screen.findByRole('alert')).textContent).toContain('déjà annulée');
});

it('propose un avis sur une réservation honorée, dans « Passées »', async () => {
  afficher();

  await userEvent.click(await screen.findByRole('tab', { name: /Passées/ }));

  expect(screen.getByRole('button', { name: /Déposer un avis/ })).toBeDefined();
  expect(screen.queryByRole('button', { name: /Annuler la réservation/ })).toBeNull();
});

it('oriente vers le catalogue quand rien n’est à venir', async () => {
  vi.mocked(recupererReservations).mockResolvedValue([]);
  afficher();

  expect(await screen.findByText(/Aucune réservation à venir/)).toBeDefined();
  expect(screen.getByRole('link', { name: /Salles/ }).getAttribute('href')).toBe(
    '/salles'
  );
});
