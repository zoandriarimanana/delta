import { afterEach, expect, it, vi } from 'vitest';

import { axiosClient } from '@/lib/axiosClient';

import { initierPaiement, simulerConfirmation } from './paiement.api';

afterEach(() => {
  vi.restoreAllMocks();
});

it.each([
  [{ type: 'client', idCommande: 7 } as const, '/commandes/7/paiements'],
  [{ type: 'invite', reference: 'abc' } as const, '/commandes/invite/abc/paiements'],
  [{ type: 'reservation', idReservation: 9 } as const, '/reservations/9/paiements'],
])('initie le paiement à la bonne adresse (%o)', async (cible, chemin) => {
  const post = vi.spyOn(axiosClient, 'post').mockResolvedValue({ data: {} });

  await initierPaiement(cible, { methode: 'Carte', fournisseur: 'Stripe' });

  expect(post).toHaveBeenCalledWith(chemin, expect.anything());
});

it('simule la confirmation d’un acompte comme celle d’une commande connectée', async () => {
  const post = vi.spyOn(axiosClient, 'post').mockResolvedValue({ data: {} });

  await simulerConfirmation({ type: 'reservation', idReservation: 9 }, 4);

  expect(post).toHaveBeenCalledWith('/paiements/4/simuler-confirmation');
});
